import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeAgentRuntime } from "./fake-agent-runtime";
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
    const expectedPath = join(
      baseDir,
      TEST_REPO_KEY,
      "runs",
      state.runId,
      "run.json"
    );
    expect(existsSync(expectedPath)).toBe(true);
  });

  test("run.json contains runId, lane, currentStage, gatesPassed, and status", async () => {
    const state = await driver.startRun(QUICK_CHANGE_NOOP);
    const raw = await readFile(
      join(baseDir, TEST_REPO_KEY, "runs", state.runId, "run.json"),
      "utf-8"
    );
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

  test("scripted runtime action is written as an artifact for the stage", async () => {
    const runtime = new FakeAgentRuntime({
      "no-op": { type: "text", content: "hello from no-op" },
    });
    const state = await driver.startRun({ ...QUICK_CHANGE_NOOP, runtime });
    const store = new InFlightStore(baseDir);
    const artifact = await store.loadArtifact(
      TEST_REPO_KEY,
      state.runId,
      "no-op"
    );
    expect(artifact).toBe("hello from no-op");
  });

  test("artifacts from all stages are on disk and loadable from a fresh store after the run", async () => {
    const runtime = new FakeAgentRuntime({
      diagnose: { type: "text", content: "found the bug" },
      fix: { type: "text", content: "applied the fix" },
    });
    const twoStageRun = {
      repoKey: TEST_REPO_KEY,
      lane: "quick-change" as const,
      stages: [{ name: "diagnose" }, { name: "fix" }],
      runtime,
    };
    const state = await driver.startRun(twoStageRun);

    const freshStore = new InFlightStore(baseDir);
    const diagnoseArtifact = await freshStore.loadArtifact(
      TEST_REPO_KEY,
      state.runId,
      "diagnose"
    );
    const fixArtifact = await freshStore.loadArtifact(
      TEST_REPO_KEY,
      state.runId,
      "fix"
    );
    expect(diagnoseArtifact).toBe("found the bug");
    expect(fixArtifact).toBe("applied the fix");
  });

  test("no artifact file is written when the runtime returns empty content", async () => {
    const runtime = new FakeAgentRuntime({});
    const state = await driver.startRun({ ...QUICK_CHANGE_NOOP, runtime });
    const store = new InFlightStore(baseDir);
    const artifact = await store.loadArtifact(
      TEST_REPO_KEY,
      state.runId,
      "no-op"
    );
    expect(artifact).toBeNull();
  });

  test("in-flight store writes outside the repository directory", async () => {
    const repoDir = process.cwd();
    const state = await driver.startRun(QUICK_CHANGE_NOOP);
    const runJsonPath = join(
      baseDir,
      TEST_REPO_KEY,
      "runs",
      state.runId,
      "run.json"
    );
    expect(runJsonPath.startsWith(repoDir)).toBe(false);
  });
});
