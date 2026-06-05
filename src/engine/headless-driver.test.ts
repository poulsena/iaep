import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { HeadlessDriver } from "./headless-driver";
import { InFlightStore } from "./inflight-store";

const TEST_REPO_KEY = "test/repo";
const QUICK_CHANGE_NOOP = {
  repoKey: TEST_REPO_KEY,
  lane: "quick-change" as const,
  stages: [{ name: "no-op" }],
};

let baseDir: string;
let driver: HeadlessDriver;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "iaep-test-"));
  driver = new HeadlessDriver({ baseDir });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("HeadlessDriver", () => {
  test("a run with one no-op stage reaches terminal state", async () => {
    const state = await driver.startRun(QUICK_CHANGE_NOOP);
    expect(state.status).toBe("terminal");
    expect(state.currentStage).toBe("terminal");
    expect(state.lane).toBe("quick-change");
  });

  test("run.json is written to <baseDir>/<repoKey>/runs/<runId>/run.json", async () => {
    const state = await driver.startRun(QUICK_CHANGE_NOOP);
    const expectedPath = join(baseDir, TEST_REPO_KEY, "runs", state.runId, "run.json");
    expect(existsSync(expectedPath)).toBe(true);
  });

  test("run.json contains runId, lane, currentStage, gatesPassed, and status", async () => {
    const state = await driver.startRun(QUICK_CHANGE_NOOP);
    const raw = await readFile(join(baseDir, TEST_REPO_KEY, "runs", state.runId, "run.json"), "utf-8");
    const persisted = JSON.parse(raw);
    expect(persisted.runId).toBe(state.runId);
    expect(persisted.lane).toBe("quick-change");
    expect(persisted.currentStage).toBe("terminal");
    expect(Array.isArray(persisted.gatesPassed)).toBe(true);
    expect(persisted.status).toBe("terminal");
  });

  test("run state is reloadable from run.json after a simulated restart", async () => {
    const state = await driver.startRun(QUICK_CHANGE_NOOP);

    // simulate restart: fresh InFlightStore with same baseDir
    const freshStore = new InFlightStore(baseDir);
    const reloaded = await freshStore.load(TEST_REPO_KEY, state.runId);

    expect(reloaded).toEqual(state);
  });

  test("in-flight store writes outside the repository directory", async () => {
    const repoDir = process.cwd();
    const state = await driver.startRun(QUICK_CHANGE_NOOP);
    const runJsonPath = join(baseDir, TEST_REPO_KEY, "runs", state.runId, "run.json");
    expect(runJsonPath.startsWith(repoDir)).toBe(false);
  });
});
