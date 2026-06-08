import { describe, expect, test } from "bun:test";
import type { RunState, StartRunOptions } from "../engine/types";

// Minimal fake driver — lets tests control exactly when callbacks fire
function makeDriver(
  startImpl: (options: StartRunOptions) => Promise<RunState>
) {
  return {
    startRun: startImpl,
    resumeRun: async () => mockState("terminal"),
  };
}

function mockState(status: RunState["status"]): RunState {
  return {
    runId: "test-run",
    lane: "quick-change",
    currentStage: status === "terminal" ? "terminal" : "work",
    gatesPassed: [],
    rejectionCount: 0,
    status,
  };
}

class FakeIpcMain {
  private readonly handlers = new Map<
    string,
    (event: null, data: unknown) => Promise<unknown>
  >();
  private readonly onceListeners: Array<{
    channel: string;
    fn: (event: null, data: unknown) => void;
  }> = [];

  handle(
    channel: string,
    handler: (event: null, data: unknown) => Promise<unknown>
  ) {
    this.handlers.set(channel, handler);
  }

  once(channel: string, listener: (event: null, data: unknown) => void) {
    this.onceListeners.push({ channel, fn: listener });
  }

  invoke(channel: string, data: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler for channel: ${channel}`);
    }
    return handler(null, data);
  }

  emit(channel: string, data: unknown) {
    const idx = this.onceListeners.findIndex((l) => l.channel === channel);
    if (idx !== -1) {
      const [{ fn }] = this.onceListeners.splice(idx, 1);
      fn(null, data);
    }
  }
}

class FakeWebContents {
  events: Array<{ channel: string; data: unknown }> = [];

  send(channel: string, data: unknown) {
    this.events.push({ channel, data });
  }

  progressEvents() {
    return this.events
      .filter((e) => e.channel === "iaep:run-progress")
      .map((e) => e.data);
  }
}

const SIMPLE_RUN = {
  repoKey: "test/repo",
  lane: "quick-change" as const,
  stages: [{ name: "diagnose" }],
};

// ── Phase 2 tests ──────────────────────────────────────────────────────────

import type { AgentRuntime, StageInput } from "../engine/types";

class FakeAgentRuntime implements AgentRuntime {
  calls: StageInput[] = [];
  execute(input: StageInput) {
    this.calls.push(input);
    return Promise.resolve({ type: "completed", content: "done" });
  }
}

describe("IpcDriverBridge", () => {
  test("iaep:start-run sends stage-started event to webContents", async () => {
    const wc = new FakeWebContents();
    const ipc = new FakeIpcMain();
    const driver = makeDriver((options) => {
      options.onProgress?.({ type: "stage-started", stage: "diagnose" });
      return Promise.resolve(mockState("terminal"));
    });

    const { IpcDriverBridge } = await import("./ipc-driver-bridge");
    new IpcDriverBridge(driver, ipc, wc);

    await ipc.invoke("iaep:start-run", SIMPLE_RUN);

    expect(wc.progressEvents()).toContainEqual({
      type: "stage-started",
      stage: "diagnose",
    });
  });

  test("iaep:start-run forwards stage-completed with content to webContents", async () => {
    const wc = new FakeWebContents();
    const ipc = new FakeIpcMain();
    const driver = makeDriver((options) => {
      options.onProgress?.({
        type: "stage-completed",
        stage: "diagnose",
        content: "found the bug",
      });
      return Promise.resolve(mockState("terminal"));
    });

    const { IpcDriverBridge } = await import("./ipc-driver-bridge");
    new IpcDriverBridge(driver, ipc, wc);

    await ipc.invoke("iaep:start-run", SIMPLE_RUN);

    expect(wc.progressEvents()).toContainEqual({
      type: "stage-completed",
      stage: "diagnose",
      content: "found the bug",
    });
  });

  test("merge gate sends iaep:run-progress gate event to webContents", async () => {
    const wc = new FakeWebContents();
    const ipc = new FakeIpcMain();
    // Driver that calls mergeGate when run starts
    const driver = makeDriver(async (options) => {
      if (options.mergeGate) {
        await options.mergeGate("test-run");
      }
      return mockState("terminal");
    });

    const { IpcDriverBridge } = await import("./ipc-driver-bridge");
    new IpcDriverBridge(driver, ipc, wc);

    // Gate event fires synchronously during invoke's async chain before mergeGate suspends
    const runPromise = ipc.invoke("iaep:start-run", SIMPLE_RUN);
    ipc.emit("iaep:gate-decision", "approve");
    await runPromise;

    expect(wc.progressEvents()).toContainEqual({
      type: "gate",
      gateType: "merge",
    });
  });

  test("approved gate-decision lets the run complete", async () => {
    const wc = new FakeWebContents();
    const ipc = new FakeIpcMain();
    const driver = makeDriver(async (options) => {
      if (options.mergeGate) {
        const decision = await options.mergeGate("test-run");
        return mockState(decision === "approve" ? "terminal" : "blocked");
      }
      return mockState("terminal");
    });

    const { IpcDriverBridge } = await import("./ipc-driver-bridge");
    new IpcDriverBridge(driver, ipc, wc);

    const runPromise = ipc.invoke("iaep:start-run", SIMPLE_RUN);
    ipc.emit("iaep:gate-decision", "approve");
    await runPromise;

    const completed = wc
      .progressEvents()
      .find((e) => (e as { type: string }).type === "run-completed") as
      | { type: "run-completed"; state: RunState }
      | undefined;
    expect(completed?.state.status).toBe("terminal");
  });

  test("configured runtime is forwarded to driver.startRun", async () => {
    const wc = new FakeWebContents();
    const ipc = new FakeIpcMain();
    let capturedRuntime: unknown;
    const driver = makeDriver((options) => {
      capturedRuntime = options.runtime;
      return Promise.resolve(mockState("terminal"));
    });
    const runtime = new FakeAgentRuntime();

    const { IpcDriverBridge } = await import("./ipc-driver-bridge");
    new IpcDriverBridge(driver, ipc, wc, runtime);

    await ipc.invoke("iaep:start-run", SIMPLE_RUN);

    expect(capturedRuntime).toBe(runtime);
  });

  test("denied gate-decision results in blocked run-completed event", async () => {
    const wc = new FakeWebContents();
    const ipc = new FakeIpcMain();
    const driver = makeDriver(async (options) => {
      if (options.mergeGate) {
        const decision = await options.mergeGate("test-run");
        return mockState(decision === "approve" ? "terminal" : "blocked");
      }
      return mockState("terminal");
    });

    const { IpcDriverBridge } = await import("./ipc-driver-bridge");
    new IpcDriverBridge(driver, ipc, wc);

    const runPromise = ipc.invoke("iaep:start-run", SIMPLE_RUN);
    ipc.emit("iaep:gate-decision", "deny");
    await runPromise;

    const completed = wc
      .progressEvents()
      .find((e) => (e as { type: string }).type === "run-completed") as
      | { type: "run-completed"; state: RunState }
      | undefined;
    expect(completed?.state.status).toBe("blocked");
  });
});
