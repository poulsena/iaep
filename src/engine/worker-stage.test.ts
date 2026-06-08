import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { FakeAgentRuntime } from "./fake-agent-runtime";
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

const SCRIPTED_EDIT = {
  type: "edit",
  content: "Added foo constant to foo.ts",
  edits: [{ path: "src/foo.ts", content: "export const foo = 1;" }],
};

describe("workerRuntime", () => {
  test("worker stage uses workerRuntime when provided instead of runtime", async () => {
    const defaultRuntime = new FakeAgentRuntime({
      implementation: SCRIPTED_EDIT,
    });
    const workerRuntime = new FakeAgentRuntime({
      implementation: SCRIPTED_EDIT,
    });
    const workerCalls: string[] = [];
    const originalExecute = workerRuntime.execute.bind(workerRuntime);
    workerRuntime.execute = (input) => {
      workerCalls.push(input.stageId);
      return originalExecute(input);
    };
    const defaultCalls: string[] = [];
    const originalDefault = defaultRuntime.execute.bind(defaultRuntime);
    defaultRuntime.execute = (input) => {
      defaultCalls.push(input.stageId);
      return originalDefault(input);
    };

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [
        { name: "diagnose" },
        { name: "implementation", role: "worker" },
      ],
      runtime: defaultRuntime,
      workerRuntime,
    });

    expect(workerCalls).toContain("implementation");
    expect(defaultCalls).not.toContain("implementation");
    expect(defaultCalls).toContain("diagnose");
  });
});

describe("Worker stage", () => {
  test("creates a feature branch in the repo", async () => {
    const runtime = new FakeAgentRuntime({ implementation: SCRIPTED_EDIT });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "implementation", role: "worker" }],
      runtime,
    });
    const branches = await git(
      repoDir,
      "branch",
      "--list",
      `feature/${state.runId}`
    );
    expect(branches).not.toBe("");
  });

  test("main branch HEAD is untouched after the worker stage", async () => {
    const mainHeadBefore = await git(repoDir, "rev-parse", "main");
    const runtime = new FakeAgentRuntime({ implementation: SCRIPTED_EDIT });
    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "fix",
      lane: "quick-change",
      stages: [{ name: "implementation", role: "worker" }],
      runtime,
    });
    const mainHeadAfter = await git(repoDir, "rev-parse", "main");
    expect(mainHeadAfter).toBe(mainHeadBefore);
  });

  test("diff-summary artifact is written to the in-flight store", async () => {
    const runtime = new FakeAgentRuntime({ implementation: SCRIPTED_EDIT });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "implementation", role: "worker" }],
      runtime,
    });
    const store = new InFlightStore(baseDir);
    const artifact = await store.loadArtifact(
      TEST_REPO_KEY,
      state.runId,
      "implementation"
    );
    expect(artifact).toBe(SCRIPTED_EDIT.content);
  });

  test("edited file is committed on the feature branch", async () => {
    const runtime = new FakeAgentRuntime({ implementation: SCRIPTED_EDIT });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [{ name: "implementation", role: "worker" }],
      runtime,
    });
    const fileOnBranch = await git(
      repoDir,
      "show",
      `feature/${state.runId}:src/foo.ts`
    );
    expect(fileOnBranch).toBe(SCRIPTED_EDIT.edits[0].content);
  });
});
