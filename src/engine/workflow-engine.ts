import type { StageDefinition, RunState, Lane } from "./types";

export class WorkflowEngine {
  run(options: { runId: string; lane: Lane; stages: StageDefinition[] }): RunState {
    return {
      runId: options.runId,
      lane: options.lane,
      currentStage: "terminal",
      gatesPassed: [],
      status: "terminal",
    };
  }
}
