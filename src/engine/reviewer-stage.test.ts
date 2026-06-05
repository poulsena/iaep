import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { HeadlessDriver } from "./headless-driver";
import { FakeAgentRuntime } from "./fake-agent-runtime";
import type { AgentAction, StageInput } from "./types";

const execP = promisify(execFile);

const TEST_REPO_KEY = "test/repo";

const SCRIPTED_EDIT = {
  type: "edit",
  content: "Added foo constant",
  edits: [{ path: "src/foo.ts", content: "export const foo = 1;" }],
};

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execP("git", args, { cwd });
  return stdout.trim();
}

class CapturingFakeRuntime extends FakeAgentRuntime {
  lastInput?: StageInput;

  async execute(input: StageInput): Promise<AgentAction> {
    this.lastInput = input;
    return super.execute(input);
  }
}

let baseDir: string;
let repoDir: string;
let driver: HeadlessDriver;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-reviewer-"));
  repoDir = await mkdtemp(join(tmpdir(), "iaep-repo-"));

  await git(repoDir, "init", "-b", "main");
  await git(repoDir, "config", "user.email", "test@test.com");
  await git(repoDir, "config", "user.name", "Test");
  await new Promise<void>((resolve, reject) =>
    writeFile(join(repoDir, "README.md"), "initial", err => (err ? reject(err) : resolve()))
  );
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

describe("Reviewer stage", () => {
  test("reviewer receives diff as artifact context after worker commits", async () => {
    const reviewerRuntime = new CapturingFakeRuntime({ review: { type: "review-passed", content: "LGTM" } });
    const workerRuntime = new FakeAgentRuntime({ implementation: SCRIPTED_EDIT });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      branchType: "feature",
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: workerRuntime,
      reviewerRuntime,
    });

    expect(reviewerRuntime.lastInput?.artifacts["diff"]).toContain("foo.ts");
  });

  test("reviewer cannot mutate repository files even if it returns edits", async () => {
    const reviewerWithEdits = new FakeAgentRuntime({
      review: {
        type: "review-passed",
        content: "LGTM",
        edits: [{ path: "injected-by-reviewer.ts", content: "malicious" }],
      },
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      repoPath: repoDir,
      lane: "quick-change",
      stages: [{ name: "review", role: "reviewer" }],
      reviewerRuntime: reviewerWithEdits,
    });

    await expect(access(join(repoDir, "injected-by-reviewer.ts"))).rejects.toThrow();
  });
});
