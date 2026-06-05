import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { FakeAgentRuntime } from "./fake-agent-runtime";
import { FakeExecutionAdapter } from "./fake-execution-adapter";
import { HeadlessDriver } from "./headless-driver";
import { InFlightStore } from "./inflight-store";

const exec = promisify(execFile);
const TEST_REPO_KEY = "test/repo";

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd });
  return stdout.trim();
}

let baseDir: string;
let repoDir: string;
let driver: HeadlessDriver;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-store-"));
  repoDir = await mkdtemp(join(tmpdir(), "iaep-repo-"));

  await git(repoDir, "init", "-b", "main");
  await git(repoDir, "config", "user.email", "test@test.com");
  await git(repoDir, "config", "user.name", "Test");
  await writeFile(join(repoDir, "README.md"), "initial");
  await git(repoDir, "add", ".");
  await git(repoDir, "commit", "-m", "initial commit");

  driver = new HeadlessDriver({ baseDir });
});

afterEach(async () => {
  await Promise.all([
    rm(baseDir, { recursive: true, force: true }),
    rm(repoDir, { recursive: true, force: true }),
  ]);
});

describe("Librarian merge gate", () => {
  test("feature branch is merged to main after gate approval", async () => {
    const mainHeadBefore = await git(repoDir, "rev-parse", "main");
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
      mergeGate: async () => "approve",
    });

    const mainHeadAfter = await git(repoDir, "rev-parse", "main");
    expect(mainHeadAfter).not.toBe(mainHeadBefore);
    const logMessage = await git(repoDir, "log", "--oneline", "-1", "main");
    expect(logMessage).toContain("Merge feature/");
  });

  test("main branch is untouched when merge gate returns deny", async () => {
    const mainHeadBefore = await git(repoDir, "rev-parse", "main");
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
      mergeGate: async () => "deny",
    });

    const mainHeadAfter = await git(repoDir, "rev-parse", "main");
    expect(mainHeadAfter).toBe(mainHeadBefore);
  });

  test("in-flight run dir is cleared after successful merge", async () => {
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
      mergeGate: async () => "approve",
    });

    const store = new InFlightStore(baseDir);
    const loaded = await store.load(TEST_REPO_KEY, state.runId);
    expect(loaded).toBeNull();
  });

  test("in-flight run dir is preserved when merge gate returns deny", async () => {
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
      mergeGate: async () => "deny",
    });

    const store = new InFlightStore(baseDir);
    const loaded = await store.load(TEST_REPO_KEY, state.runId);
    expect(loaded?.status).toBe("blocked");
  });
});

describe("Librarian stage", () => {
  test("librarian writes CONTEXT.md with action content and run reaches merged", async () => {
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
      mergeGate: async () => "approve",
    });

    expect(state.status).toBe("merged");
    const content = await readFile(join(repoDir, "CONTEXT.md"), "utf-8");
    expect(content).toBe("# Updated context");
  });

  test("librarian blocks when no mergeGate is provided", async () => {
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
    });

    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("librarian");
  });

  test("librarian blocks when mergeGate returns deny", async () => {
    const runtime = new FakeAgentRuntime({
      librarian: { type: "text", content: "# Updated context" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "librarian", role: "librarian" }],
      runtime,
      mergeGate: async () => "deny",
    });

    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("librarian");
  });
});

describe("Quick-change lane end to end", () => {
  test("full lane merges to main, updates CONTEXT.md on main, and clears run dir", async () => {
    const SCRIPTED_EDIT = {
      type: "edit",
      content: "Added foo constant",
      edits: [{ path: "src/foo.ts", content: "export const foo = 1;" }],
    };

    const runtime = new FakeAgentRuntime({
      implementation: SCRIPTED_EDIT,
      librarian: { type: "text", content: "# Context after merge" },
    });
    const reviewerRuntime = new FakeAgentRuntime({
      review: { type: "review-passed", content: "LGTM" },
    });
    const adapter = new FakeExecutionAdapter({ success: true, output: "" });

    const stages = [
      { name: "implementation", role: "worker" as const },
      { name: "qa", role: "qa" as const },
      { name: "review", role: "reviewer" as const },
      { name: "librarian", role: "librarian" as const },
    ];

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages,
      runtime,
      reviewerRuntime,
      adapter,
      mergeGate: async () => "approve",
    });

    expect(state.status).toBe("merged");

    // CONTEXT.md is on main
    const contextOnMain = await git(repoDir, "show", "main:CONTEXT.md");
    expect(contextOnMain).toBe("# Context after merge");

    // Run dir is cleared
    const store = new InFlightStore(baseDir);
    const loaded = await store.load(TEST_REPO_KEY, state.runId);
    expect(loaded).toBeNull();
  });
});
