import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeAgentRuntime } from "./fake-agent-runtime";
import { HeadlessDriver } from "./headless-driver";

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

describe("Audit log", () => {
  test("audit.log is written to the run directory after a reach-controlled run", async () => {
    const runtime = new FakeAgentRuntime({
      work: { type: "text", content: "done", tool: "edit_file" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: { allowedTools: ["edit_file"] },
    });
    const auditPath = join(
      baseDir,
      TEST_REPO_KEY,
      "runs",
      state.runId,
      "audit.log"
    );
    expect(existsSync(auditPath)).toBe(true);
  });

  test("audit.log has one entry per action through the chokepoint", async () => {
    const runtime = new FakeAgentRuntime({
      diagnose: { type: "text", content: "result", tool: "read_file" },
      fix: { type: "text", content: "fixed", tool: "edit_file" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "diagnose" }, { name: "fix" }],
      runtime,
      reachControl: { allowedTools: ["read_file", "edit_file"] },
    });
    const auditPath = join(
      baseDir,
      TEST_REPO_KEY,
      "runs",
      state.runId,
      "audit.log"
    );
    const raw = await readFile(auditPath, "utf-8");
    const entries = raw
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries).toHaveLength(2);
    expect(entries[0].stageId).toBe("diagnose");
    expect(entries[1].stageId).toBe("fix");
  });

  test("each audit entry records the tool and decision", async () => {
    const runtime = new FakeAgentRuntime({
      work: { type: "text", content: "done", tool: "edit_file" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: { allowedTools: ["edit_file"] },
    });
    const auditPath = join(
      baseDir,
      TEST_REPO_KEY,
      "runs",
      state.runId,
      "audit.log"
    );
    const raw = await readFile(auditPath, "utf-8");
    const entry = JSON.parse(raw.trim());
    expect(entry.tool).toBe("edit_file");
    expect(entry.decision).toBe("allowed");
    expect(entry.runId).toBe(state.runId);
    expect(entry.stageId).toBe("work");
    expect(typeof entry.timestamp).toBe("string");
  });

  test("audit.log is append-only: multiple actions produce multiple entries without overwriting", async () => {
    const runtime = new FakeAgentRuntime({
      s1: { type: "text", content: "a", tool: "read_file" },
      s2: { type: "text", content: "b", tool: "edit_file" },
      s3: { type: "text", content: "c", tool: "bash" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "s1" }, { name: "s2" }, { name: "s3" }],
      runtime,
      reachControl: { allowedTools: ["read_file", "edit_file", "bash"] },
    });
    const auditPath = join(
      baseDir,
      TEST_REPO_KEY,
      "runs",
      state.runId,
      "audit.log"
    );
    const raw = await readFile(auditPath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(3);
    const tools = lines.map((l) => JSON.parse(l).tool);
    expect(tools).toEqual(["read_file", "edit_file", "bash"]);
  });
});

describe("Approval gate", () => {
  test("gated tool + deny decision blocks the run", async () => {
    const runtime = new FakeAgentRuntime({
      work: { type: "text", content: "done", tool: "bash" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: {
        allowedTools: ["edit_file", "bash"],
        gatedTools: ["bash"],
      },
      approver: async () => "deny",
    });
    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("work");
  });

  test("gated tool + approve decision lets the run reach terminal", async () => {
    const runtime = new FakeAgentRuntime({
      work: { type: "text", content: "done", tool: "bash" },
    });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: {
        allowedTools: ["edit_file", "bash"],
        gatedTools: ["bash"],
      },
      approver: async () => "approve",
    });
    expect(state.status).toBe("terminal");
  });

  test("approver is called with the correct stageId and action for a gated tool", async () => {
    const calls: Array<{ stageId: string; tool?: string }> = [];
    const runtime = new FakeAgentRuntime({
      work: { type: "text", content: "done", tool: "bash" },
    });
    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "work" }],
      runtime,
      reachControl: { allowedTools: ["bash"], gatedTools: ["bash"] },
      approver: (stageId, action) => {
        calls.push({ stageId, tool: action.tool });
        return Promise.resolve("approve" as const);
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].stageId).toBe("work");
    expect(calls[0].tool).toBe("bash");
  });
});
