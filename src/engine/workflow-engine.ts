import {
  applyEdits,
  commitEdits,
  createFeatureBranch,
  getDiff,
} from "./git-ops";
import type {
  AgentAction,
  AgentRuntime,
  BranchType,
  ExecutionAdapter,
  Lane,
  RunState,
  StageDefinition,
} from "./types";

type ReviewOutcome =
  | { type: "passed" }
  | { type: "blocked"; rejectionCount: number }
  | {
      type: "loopback";
      toIndex: number;
      artifacts: Record<string, string>;
      rejectionCount: number;
    };

type DefaultStageOutcome =
  | { type: "blocked" }
  | { type: "completed"; artifacts: Record<string, string> };

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
    maxRetries?: number;
    startIndex?: number;
    initialArtifacts?: Record<string, string>;
    initialGatesPassed?: string[];
    initialRejectionCount?: number;
    saveArtifact: (stageId: string, content: string) => Promise<void>;
  }): Promise<RunState> {
    let artifacts: Record<string, string> = options.initialArtifacts ?? {};
    const gatesPassed: string[] = options.initialGatesPassed ?? [];
    let rejectionCount = options.initialRejectionCount ?? 0;
    let workerStageIndex = -1;
    let preWorkerArtifacts: Record<string, string> = {};

    if (options.repoPath && options.stages.some((s) => s.role === "worker")) {
      await createFeatureBranch(
        options.repoPath,
        options.branchType ?? "feature",
        options.runId
      );
    }

    let i = options.startIndex ?? 0;
    while (i < options.stages.length) {
      const stage = options.stages[i];

      if (stage.role === "worker") {
        workerStageIndex = i;
        preWorkerArtifacts = { ...artifacts };
      }

      if (stage.role === "reviewer") {
        if (!options.reviewerRuntime) {
          throw new Error("reviewer stage requires reviewerRuntime");
        }
        const outcome = await this.runReviewerStage(
          stage,
          options.reviewerRuntime,
          artifacts,
          preWorkerArtifacts,
          workerStageIndex,
          rejectionCount,
          options.runId,
          options.repoPath,
          options.maxRetries ?? 2,
          options.saveArtifact
        );
        if (outcome.type === "loopback") {
          artifacts = outcome.artifacts;
          rejectionCount = outcome.rejectionCount;
          i = outcome.toIndex;
          continue;
        }
        if (outcome.type === "blocked") {
          return {
            runId: options.runId,
            lane: options.lane,
            currentStage: stage.name,
            gatesPassed,
            rejectionCount: outcome.rejectionCount,
            status: "blocked",
          };
        }
        gatesPassed.push(stage.name);
        i++;
        continue;
      }

      if (stage.role === "qa") {
        const passed = await this.runQaStage(options.adapter);
        if (!passed) {
          return {
            runId: options.runId,
            lane: options.lane,
            currentStage: stage.name,
            gatesPassed,
            rejectionCount,
            status: "blocked",
          };
        }
        gatesPassed.push(stage.name);
        i++;
        continue;
      }

      const result = await this.runDefaultStage(
        stage,
        options.runtime,
        options.runId,
        artifacts,
        options.repoPath,
        options.saveArtifact
      );
      if (result.type === "blocked") {
        return {
          runId: options.runId,
          lane: options.lane,
          currentStage: stage.name,
          gatesPassed,
          rejectionCount,
          status: "blocked",
        };
      }
      artifacts = result.artifacts;

      i++;
    }

    return {
      runId: options.runId,
      lane: options.lane,
      currentStage: "terminal",
      gatesPassed,
      rejectionCount,
      status: "terminal",
    };
  }

  private async runReviewerStage(
    stage: StageDefinition,
    reviewerRuntime: AgentRuntime,
    artifacts: Record<string, string>,
    preWorkerArtifacts: Record<string, string>,
    workerStageIndex: number,
    rejectionCount: number,
    runId: string,
    repoPath: string | undefined,
    maxRetries: number,
    saveArtifact: (stageId: string, content: string) => Promise<void>
  ): Promise<ReviewOutcome> {
    const reviewerArtifacts = { ...artifacts };
    if (repoPath) {
      reviewerArtifacts.diff = await getDiff(repoPath);
    }
    const action = await reviewerRuntime.execute({
      stageId: stage.name,
      runId,
      artifacts: reviewerArtifacts,
    });

    if (action.type === "review-rejected" && rejectionCount < maxRetries) {
      return this.buildLoopback(
        stage.name,
        action,
        preWorkerArtifacts,
        workerStageIndex,
        rejectionCount,
        saveArtifact
      );
    }

    if (action.type !== "review-passed") {
      const finalCount =
        action.type === "review-rejected" ? rejectionCount + 1 : rejectionCount;
      return { type: "blocked", rejectionCount: finalCount };
    }

    return { type: "passed" };
  }

  private async buildLoopback(
    stageName: string,
    action: AgentAction,
    preWorkerArtifacts: Record<string, string>,
    workerStageIndex: number,
    rejectionCount: number,
    saveArtifact: (stageId: string, content: string) => Promise<void>
  ): Promise<ReviewOutcome> {
    const rejectionKey = `${stageName}-rejection`;
    if (action.content) {
      await saveArtifact(rejectionKey, action.content);
    }
    const artifacts = {
      ...preWorkerArtifacts,
      ...(action.content ? { [rejectionKey]: action.content } : {}),
    };
    return {
      type: "loopback",
      toIndex: workerStageIndex,
      artifacts,
      rejectionCount: rejectionCount + 1,
    };
  }

  private async runQaStage(
    adapter: ExecutionAdapter | undefined
  ): Promise<boolean> {
    if (!adapter) {
      throw new Error("qa stage requires adapter");
    }
    const result = await adapter.test();
    return result.success;
  }

  private async runDefaultStage(
    stage: StageDefinition,
    runtime: AgentRuntime,
    runId: string,
    artifacts: Record<string, string>,
    repoPath: string | undefined,
    saveArtifact: (stageId: string, content: string) => Promise<void>
  ): Promise<DefaultStageOutcome> {
    const action = await runtime.execute({
      stageId: stage.name,
      runId,
      artifacts: { ...artifacts },
    });

    if (action.type === "blocked") {
      return { type: "blocked" };
    }

    await this.applyWorkerEdits(stage, action, repoPath);

    const updated = { ...artifacts };
    if (action.content) {
      await saveArtifact(stage.name, action.content);
      updated[stage.name] = action.content;
    }
    return { type: "completed", artifacts: updated };
  }

  private async applyWorkerEdits(
    stage: StageDefinition,
    action: AgentAction,
    repoPath: string | undefined
  ): Promise<void> {
    if (
      stage.role === "worker" &&
      action.type === "edit" &&
      action.edits?.length &&
      repoPath
    ) {
      await applyEdits(repoPath, action.edits);
      await commitEdits(repoPath, stage.name);
    }
  }
}
