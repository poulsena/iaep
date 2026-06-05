import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { HeadlessDriver } from "./headless-driver";
import { FakeAgentRuntime } from "./fake-agent-runtime";

const TEST_REPO_KEY = "test/repo";

let baseDir: string;
let driver: HeadlessDriver;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-reach-"));
  driver = new HeadlessDriver({ baseDir });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("Reach-control chokepoint", () => {
  test("out-of-scope file path is blocked at the runtime seam", async () => {
    const runtime = new FakeAgentRuntime({
      work: {
        type: "edit",
        content: "wrote something",
        tool: "edit_file",
        edits: [{ path: "/tmp/evil.ts", content: "malicious" }],
      },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: { allowedTools: ["edit_file"] },
    });
    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("work");
  });

  test("allowed tool with in-scope path reaches terminal", async () => {
    const runtime = new FakeAgentRuntime({
      work: {
        type: "text",
        content: "done",
        tool: "edit_file",
      },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: { allowedTools: ["edit_file"] },
    });
    expect(state.status).toBe("terminal");
  });

  test("disallowed tool is blocked at the runtime seam", async () => {
    const runtime = new FakeAgentRuntime({
      work: { type: "text", content: "done", tool: "bash" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: { allowedTools: ["edit_file"] },
    });
    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("work");
  });
});
