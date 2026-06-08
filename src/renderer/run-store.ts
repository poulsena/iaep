import { writable } from "svelte/store";
import type { ProgressEvent, RunState, StartRunOptions } from "../engine/types";

interface IpcRendererLike {
  invoke(channel: string, data?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, data: unknown) => void): void;
  send(channel: string, data: unknown): void;
}

type StoreStatus = "idle" | RunState["status"];

export function createRunStore(ipc: IpcRendererLike) {
  const currentStage = writable<string | null>(null);
  const status = writable<StoreStatus>("idle");
  const outputEntries = writable<Array<{ stageId: string; content: string }>>(
    []
  );
  const gateVisible = writable(false);
  const gateType = writable<"approval" | "merge" | null>(null);

  ipc.on("iaep:run-progress", (_event, data) => {
    const e = data as ProgressEvent;
    if (e.type === "stage-started") {
      currentStage.set(e.stage);
    } else if (e.type === "stage-completed") {
      outputEntries.update((entries) => [
        ...entries,
        { stageId: e.stage, content: e.content },
      ]);
    } else if (e.type === "gate") {
      gateVisible.set(true);
      gateType.set(e.gateType);
    } else if (e.type === "run-completed") {
      status.set(e.state.status);
      currentStage.set(e.state.currentStage);
      gateVisible.set(false);
    }
  });

  async function start(
    options: Pick<StartRunOptions, "repoKey" | "lane" | "stages" | "repoPath">
  ) {
    status.set("running");
    outputEntries.set([]);
    await ipc.invoke("iaep:start-run", options);
  }

  function decide(decision: "approve" | "deny") {
    ipc.send("iaep:gate-decision", decision);
    gateVisible.set(false);
  }

  return {
    currentStage,
    decide,
    gateType,
    gateVisible,
    outputEntries,
    start,
    status,
  };
}
