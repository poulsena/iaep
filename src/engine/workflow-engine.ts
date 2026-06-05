import type { StageDefinition, RunState, Lane, AgentRuntime, BranchType, ExecutionAdapter } from "./types";
import { createFeatureBranch, applyEdits, commitEdits, getDiff } from "./git-ops";

export class WorkflowEngine {
  async run(options: {
    runId: string;
    lane: Lane;
    stages: StageDefinition[];
    runtime: AgentRuntime;
    reviewerRuntime?: AgentRuntime;
    adapter?: ExecutionAdapter;
    repoPath?: string;
    branchType?: BranchType;
    saveArtifact: (stageId: string, content: string) => Promise<void>;
  }): Promise<RunState> {
    const artifacts: Record<string, string> = {};
    const gatesPassed: string[] = [];

    if (options.repoPath && options.stages.some(s => s.role === "worker")) {
      await createFeatureBranch(options.repoPath, options.branchType ?? "feature", options.runId);
    }

    for (const stage of options.stages) {
      if (stage.role === "reviewer") {
        const reviewerArtifacts = { ...artifacts };
        if (options.repoPath) {
          reviewerArtifacts["diff"] = await getDiff(options.repoPath);
        }
        const action = await options.reviewerRuntime!.execute({
          stageId: stage.name,
          runId: options.runId,
          artifacts: reviewerArtifacts,
        });
        if (action.type !== "review-passed") {
          return {
            runId: options.runId,
            lane: options.lane,
            currentStage: stage.name,
            gatesPassed,
            status: "blocked",
          };
        }
        gatesPassed.push(stage.name);
        continue;
      }

      if (stage.role === "qa") {
        const result = await options.adapter!.test();
        if (!result.success) {
          return {
            runId: options.runId,
            lane: options.lane,
            currentStage: stage.name,
            gatesPassed,
            status: "blocked",
          };
        }
        gatesPassed.push(stage.name);
        continue;
      }

      const action = await options.runtime.execute({
        stageId: stage.name,
        runId: options.runId,
        artifacts,
      });

      if (stage.role === "worker" && action.type === "edit" && action.edits?.length && options.repoPath) {
        await applyEdits(options.repoPath, action.edits);
        await commitEdits(options.repoPath, stage.name);
      }

      if (action.content) {
        await options.saveArtifact(stage.name, action.content);
        artifacts[stage.name] = action.content;
      }
    }

    return {
      runId: options.runId,
      lane: options.lane,
      currentStage: "terminal",
      gatesPassed,
      status: "terminal",
    };
  }
}
