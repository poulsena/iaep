import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { HeadlessDriver } from "./headless-driver";
import { FakeExecutionAdapter } from "./fake-execution-adapter";

const TEST_REPO_KEY = "test/repo";

let baseDir: string;
let driver: HeadlessDriver;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-qa-"));
  driver = new HeadlessDriver({ baseDir });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("QA gate", () => {
  test("green tests: run reaches terminal and QA stage is in gatesPassed", async () => {
    const adapter = new FakeExecutionAdapter({ success: true, output: "all tests passed" });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "qa", role: "qa" }],
      adapter,
    });
    expect(state.status).toBe("terminal");
    expect(state.gatesPassed).toContain("qa");
  });

  test("red tests: run is blocked and currentStage stays at the QA stage", async () => {
    const adapter = new FakeExecutionAdapter({ success: false, output: "2 tests failed" });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "qa", role: "qa" }],
      adapter,
    });
    expect(state.status).toBe("blocked");
    expect(state.currentStage).toBe("qa");
  });

  test("red tests: QA stage is not in gatesPassed", async () => {
    const adapter = new FakeExecutionAdapter({ success: false, output: "2 tests failed" });
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "qa", role: "qa" }],
      adapter,
    });
    expect(state.gatesPassed).not.toContain("qa");
  });

  test("a run with no QA stage and no adapter reaches terminal unchanged", async () => {
    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "diagnose" }],
    });
    expect(state.status).toBe("terminal");
    expect(state.currentStage).toBe("terminal");
  });
});
