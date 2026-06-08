import { get } from "svelte/store";
import { describe, expect, test } from "vitest";
import type { ProgressEvent, RunState } from "../engine/types";

// Fake ipcRenderer: drives events into the store and captures outgoing sends
class FakeIpc {
  private readonly listeners = new Map<
    string,
    Array<(event: null, data: unknown) => void>
  >();
  readonly sent: Array<{ channel: string; data: unknown }> = [];

  on(channel: string, listener: (event: null, data: unknown) => void) {
    const existing = this.listeners.get(channel) ?? [];
    this.listeners.set(channel, [...existing, listener]);
  }

  send(channel: string, data: unknown) {
    this.sent.push({ channel, data });
  }

  invoke(channel: string, data: unknown): Promise<unknown> {
    this.sent.push({ channel, data });
    return Promise.resolve(undefined);
  }

  emit(channel: string, data: unknown) {
    for (const listener of this.listeners.get(channel) ?? []) {
      listener(null, data);
    }
  }

  progress(event: ProgressEvent) {
    this.emit("iaep:run-progress", event);
  }
}

function mockRunState(status: RunState["status"]): RunState {
  return {
    runId: "r1",
    lane: "quick-change",
    currentStage: status === "terminal" ? "terminal" : "work",
    gatesPassed: [],
    rejectionCount: 0,
    status,
  };
}

describe("runStore", () => {
  test("initial state: currentStage null, status idle, no output, gate hidden", async () => {
    const { createRunStore } = await import("./run-store");
    const ipc = new FakeIpc();
    const store = createRunStore(ipc);

    expect(get(store.currentStage)).toBeNull();
    expect(get(store.status)).toBe("idle");
    expect(get(store.outputEntries)).toHaveLength(0);
    expect(get(store.gateVisible)).toBe(false);
  });

  test("stage-started event updates currentStage", async () => {
    const { createRunStore } = await import("./run-store");
    const ipc = new FakeIpc();
    const store = createRunStore(ipc);

    ipc.progress({ type: "stage-started", stage: "diagnose" });

    expect(get(store.currentStage)).toBe("diagnose");
  });

  test("stage-completed event appends to outputEntries", async () => {
    const { createRunStore } = await import("./run-store");
    const ipc = new FakeIpc();
    const store = createRunStore(ipc);

    ipc.progress({
      type: "stage-completed",
      stage: "diagnose",
      content: "found the bug",
    });
    ipc.progress({ type: "stage-completed", stage: "fix", content: "fixed" });

    expect(get(store.outputEntries)).toEqual([
      { stageId: "diagnose", content: "found the bug" },
      { stageId: "fix", content: "fixed" },
    ]);
  });

  test("gate event makes gateVisible true and sets gateType", async () => {
    const { createRunStore } = await import("./run-store");
    const ipc = new FakeIpc();
    const store = createRunStore(ipc);

    ipc.progress({ type: "gate", gateType: "merge" });

    expect(get(store.gateVisible)).toBe(true);
    expect(get(store.gateType)).toBe("merge");
  });

  test("decide sends iaep:gate-decision and hides gate", async () => {
    const { createRunStore } = await import("./run-store");
    const ipc = new FakeIpc();
    const store = createRunStore(ipc);

    ipc.progress({ type: "gate", gateType: "merge" });
    store.decide("approve");

    const sent = ipc.sent.find((s) => s.channel === "iaep:gate-decision");
    expect(sent?.data).toBe("approve");
    expect(get(store.gateVisible)).toBe(false);
  });

  test("run-completed event updates status and currentStage", async () => {
    const { createRunStore } = await import("./run-store");
    const ipc = new FakeIpc();
    const store = createRunStore(ipc);

    ipc.progress({ type: "run-completed", state: mockRunState("terminal") });

    expect(get(store.status)).toBe("terminal");
    expect(get(store.currentStage)).toBe("terminal");
  });
});
