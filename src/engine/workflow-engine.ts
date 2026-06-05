import type { StageDefinition, RunState, Lane, AgentRuntime } from "./types";

export class WorkflowEngine {
  async run(options: {
    runId: string;
    lane: Lane;
    stages: StageDefinition[];
    runtime: AgentRuntime;
    saveArtifact: (stageId: string, content: string) => Promise<void>;
  }): Promise<RunState> {
    const artifacts: Record<string, string> = {};

    for (const stage of options.stages) {
      const action = await options.runtime.execute({
        stageId: stage.name,
        runId: options.runId,
        artifacts,
      });
      if (action.content) {
        await options.saveArtifact(stage.name, action.content);
        artifacts[stage.name] = action.content;
      }
    }

    return {
      runId: options.runId,
      lane: options.lane,
      currentStage: "terminal",
      gatesPassed: [],
      status: "terminal",
    };
  }
}
