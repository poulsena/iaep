import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CapturingSequencedRuntime,
  FakeAgentRuntime,
  SequencedFakeAgentRuntime,
} from "./fake-agent-runtime";
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

describe("Rejection loop-back", () => {
  test("reviewer rejects then passes: run reaches terminal", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const reviewerRuntime = new SequencedFakeAgentRuntime({
      review: [
        { type: "review-rejected", content: "needs better error handling" },
        { type: "review-passed", content: "LGTM" },
      ],
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: workerRuntime,
      reviewerRuntime,
    });

    expect(state.status).toBe("terminal");
    expect(state.currentStage).toBe("terminal");
  });

  test("rejection artifact is written to the in-flight store with the reviewer's feedback", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const reviewerRuntime = new SequencedFakeAgentRuntime({
      review: [
        { type: "review-rejected", content: "needs better error handling" },
        { type: "review-passed", content: "LGTM" },
      ],
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: workerRuntime,
      reviewerRuntime,
    });

    const store = new InFlightStore(baseDir);
    const rejectionArtifact = await store.loadArtifact(
      TEST_REPO_KEY,
      state.runId,
      "review-rejection"
    );
    expect(rejectionArtifact).toBe("needs better error handling");
  });

  test("retry implementation is seeded by the rejection artifact", async () => {
    const capturingWorker = new CapturingSequencedRuntime({
      implementation: [
        { type: "text", content: "first attempt" },
        { type: "text", content: "second attempt" },
      ],
    });
    const reviewerRuntime = new SequencedFakeAgentRuntime({
      review: [
        { type: "review-rejected", content: "needs better error handling" },
        { type: "review-passed", content: "LGTM" },
      ],
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: capturingWorker,
      reviewerRuntime,
    });

    expect(
      capturingWorker.inputsFor("implementation")[1].artifacts[
        "review-rejection"
      ]
    ).toBe("needs better error handling");
  });

  test("retry implementation does not receive the previous implementation's artifact", async () => {
    const capturingWorker = new CapturingSequencedRuntime({
      implementation: [
        { type: "text", content: "first attempt" },
        { type: "text", content: "second attempt" },
      ],
    });
    const reviewerRuntime = new SequencedFakeAgentRuntime({
      review: [
        { type: "review-rejected", content: "needs better error handling" },
        { type: "review-passed", content: "LGTM" },
      ],
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: capturingWorker,
      reviewerRuntime,
    });

    expect(
      capturingWorker.inputsFor("implementation")[1].artifacts.implementation
    ).toBeUndefined();
  });

  test("second rejection blocks the run when maxRetries is 1", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const reviewerRuntime = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "still not good enough" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: workerRuntime,
      reviewerRuntime,
      maxRetries: 1,
    });

    expect(state.status).toBe("blocked");
    expect(state.rejectionCount).toBe(2);
  });

  test("retry budget of 0 means first rejection blocks the run", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const reviewerRuntime = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "not good enough" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: workerRuntime,
      reviewerRuntime,
      maxRetries: 0,
    });

    expect(state.status).toBe("blocked");
    expect(state.rejectionCount).toBe(1);
  });

  test("default retry budget is 2: third rejection blocks the run", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const reviewerRuntime = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "still not good enough" },
    });

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [
        { name: "implementation", role: "worker" },
        { name: "review", role: "reviewer" },
      ],
      runtime: workerRuntime,
      reviewerRuntime,
    });

    expect(state.status).toBe("blocked");
    expect(state.rejectionCount).toBe(3);
  });
});

describe("Human-escalation resumability", () => {
  const stages = [
    { name: "implementation", role: "worker" as const },
    { name: "review", role: "reviewer" as const },
  ];

  test("an approved resume of a parked run reaches terminal", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const rejectingReviewer = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "not good enough" },
    });
    const passingReviewer = new FakeAgentRuntime({
      review: { type: "review-passed", content: "LGTM" },
    });

    const parkedState = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages,
      runtime: workerRuntime,
      reviewerRuntime: rejectingReviewer,
      maxRetries: 0,
    });

    expect(parkedState.status).toBe("blocked");

    // Simulate restart: fresh driver, same baseDir
    const freshDriver = new HeadlessDriver({ baseDir });
    const resumedState = await freshDriver.resumeRun({
      repoKey: TEST_REPO_KEY,
      runId: parkedState.runId,
      stages,
      runtime: workerRuntime,
      reviewerRuntime: passingReviewer,
      decision: "approved",
    });

    expect(resumedState.status).toBe("terminal");
    expect(resumedState.currentStage).toBe("terminal");
  });

  test("a denied resume keeps the run blocked", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const reviewerRuntime = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "not good enough" },
    });

    const parkedState = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages,
      runtime: workerRuntime,
      reviewerRuntime,
      maxRetries: 0,
    });

    const freshDriver = new HeadlessDriver({ baseDir });
    const resumedState = await freshDriver.resumeRun({
      repoKey: TEST_REPO_KEY,
      runId: parkedState.runId,
      stages,
      runtime: workerRuntime,
      reviewerRuntime,
      decision: "denied",
    });

    expect(resumedState.status).toBe("blocked");
  });

  test("resumed run includes reviewer stage in gatesPassed", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const rejectingReviewer = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "not good enough" },
    });
    const passingReviewer = new FakeAgentRuntime({
      review: { type: "review-passed", content: "LGTM" },
    });

    const parkedState = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages,
      runtime: workerRuntime,
      reviewerRuntime: rejectingReviewer,
      maxRetries: 0,
    });

    const freshDriver = new HeadlessDriver({ baseDir });
    const resumedState = await freshDriver.resumeRun({
      repoKey: TEST_REPO_KEY,
      runId: parkedState.runId,
      stages,
      runtime: workerRuntime,
      reviewerRuntime: passingReviewer,
      decision: "approved",
    });

    expect(resumedState.gatesPassed).toContain("review");
  });

  test("resume re-runs the blocked stage: rejecting reviewer on resume re-blocks the run", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const rejectingReviewer = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "not good enough" },
    });

    const parkedState = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages,
      runtime: workerRuntime,
      reviewerRuntime: rejectingReviewer,
      maxRetries: 0,
    });

    const freshDriver = new HeadlessDriver({ baseDir });
    const resumedState = await freshDriver.resumeRun({
      repoKey: TEST_REPO_KEY,
      runId: parkedState.runId,
      stages,
      runtime: workerRuntime,
      reviewerRuntime: rejectingReviewer,
      decision: "approved",
    });

    expect(resumedState.status).toBe("blocked");
  });

  test("resumed run state is persisted to disk", async () => {
    const workerRuntime = new FakeAgentRuntime({
      implementation: { type: "text", content: "implemented" },
    });
    const rejectingReviewer = new FakeAgentRuntime({
      review: { type: "review-rejected", content: "not good enough" },
    });
    const passingReviewer = new FakeAgentRuntime({
      review: { type: "review-passed", content: "LGTM" },
    });

    const parkedState = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages,
      runtime: workerRuntime,
      reviewerRuntime: rejectingReviewer,
      maxRetries: 0,
    });

    const freshDriver = new HeadlessDriver({ baseDir });
    await freshDriver.resumeRun({
      repoKey: TEST_REPO_KEY,
      runId: parkedState.runId,
      stages,
      runtime: workerRuntime,
      reviewerRuntime: passingReviewer,
      decision: "approved",
    });

    const store = new InFlightStore(baseDir);
    const reloaded = await store.load(TEST_REPO_KEY, parkedState.runId);
    expect(reloaded?.status).toBe("terminal");
  });
});

describe("Durable-layer seeding", () => {
  let repoDir: string;

  beforeEach(async () => {
    repoDir = await mkdtemp(join(tmpdir(), "iaep-repo-"));
  });

  afterEach(async () => {
    await rm(repoDir, { recursive: true, force: true });
  });

  test("stage receives durable:context containing CONTEXT.md content", async () => {
    await writeFile(join(repoDir, "CONTEXT.md"), "# Project context");

    const runtime = new CapturingSequencedRuntime({
      diagnose: [{ type: "text", content: "done" }],
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "diagnose" }],
      runtime,
      repoPath: repoDir,
    });

    expect(runtime.inputsFor("diagnose")[0].artifacts["durable:context"]).toBe(
      "# Project context"
    );
  });

  test("stage receives durable:context-map containing CONTEXT-MAP.md content when present", async () => {
    await writeFile(join(repoDir, "CONTEXT.md"), "# Project context");
    await writeFile(join(repoDir, "CONTEXT-MAP.md"), "# Context map");

    const runtime = new CapturingSequencedRuntime({
      diagnose: [{ type: "text", content: "done" }],
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "diagnose" }],
      runtime,
      repoPath: repoDir,
    });

    expect(
      runtime.inputsFor("diagnose")[0].artifacts["durable:context-map"]
    ).toBe("# Context map");
  });

  test("run reaches terminal when CONTEXT-MAP.md is absent", async () => {
    await writeFile(join(repoDir, "CONTEXT.md"), "# Project context");
    // no CONTEXT-MAP.md

    const state = await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "diagnose" }],
      repoPath: repoDir,
    });

    expect(state.status).toBe("terminal");
  });

  test("stage does not receive durable:context when repoPath is not provided", async () => {
    const runtime = new CapturingSequencedRuntime({
      diagnose: [{ type: "text", content: "done" }],
    });

    await driver.startRun({
      repoKey: TEST_REPO_KEY,
      lane: "quick-change",
      stages: [{ name: "diagnose" }],
      runtime,
    });

    expect(
      runtime.inputsFor("diagnose")[0].artifacts["durable:context"]
    ).toBeUndefined();
  });
});
