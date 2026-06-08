import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  applyEdits,
  commitEdits,
  createFeatureBranch,
  getDiff,
  mergeToMain,
} from "./git-ops";
import type {
  AgentAction,
  AgentRuntime,
  BranchType,
  Brief,
  ExecutionAdapter,
  Lane,
  ProgressEvent,
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
  | { type: "completed"; artifacts: Record<string, string>; content: string };

interface RunOptions {
  adapter?: ExecutionAdapter;
  branchType?: BranchType;
  brief?: Brief;
  initialArtifacts?: Record<string, string>;
  initialGatesPassed?: string[];
  initialRejectionCount?: number;
  lane: Lane;
  maxRetries?: number;
  mergeGate?: (runId: string) => Promise<"approve" | "deny">;
  onProgress?: (event: ProgressEvent) => void;
  repoPath?: string;
  reviewerRuntime?: AgentRuntime;
  runId: string;
  runtime: AgentRuntime;
  saveArtifact: (stageId: string, content: string) => Promise<void>;
  stages: StageDefinition[];
  startIndex?: number;
}

export class WorkflowEngine {
  async run(options: RunOptions): Promise<RunState> {
    let artifacts: Record<string, string> = options.initialArtifacts ?? {};
    if (options.repoPath) {
      const durable = await readDurableContext(options.repoPath);
      artifacts = { ...durable, ...artifacts };
    }
    const branchType = options.branchType ?? "feature";
    const featureBranch = `${branchType}/${options.runId}`;
    const needsBranch = options.stages.some(
      (s) => s.role === "worker" || s.role === "librarian"
    );
    if (options.repoPath && needsBranch && !options.startIndex) {
      await createFeatureBranch(options.repoPath, branchType, options.runId);
    }
    const state = await this.executeStages(
      options,
      artifacts,
      featureBranch,
      options.brief
    );
    options.onProgress?.({ type: "run-completed", state });
    return state;
  }

  private async executeStages(
    options: RunOptions,
    initialArtifacts: Record<string, string>,
    featureBranch: string,
    brief?: Brief
  ): Promise<RunState> {
    let artifacts = initialArtifacts;
    const gatesPassed: string[] = options.initialGatesPassed ?? [];
    let rejectionCount = options.initialRejectionCount ?? 0;
    let workerStageIndex = -1;
    let preWorkerArtifacts: Record<string, string> = {};

    const emit = options.onProgress;

    const firstStageIndex = options.startIndex ?? 0;
    let i = firstStageIndex;
    while (i < options.stages.length) {
      const stage = options.stages[i];
      const stagesBrief = i === firstStageIndex ? brief : undefined;

      emit?.({ type: "stage-started", stage: stage.name });

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
          options.saveArtifact,
          stagesBrief
        );
        const next = this.applyReviewOutcome(
          outcome,
          stage.name,
          options,
          gatesPassed,
          brief
        );
        if (next.type === "loopback") {
          artifacts = next.artifacts;
          rejectionCount = next.rejectionCount;
          i = next.toIndex;
          continue;
        }
        if (next.type === "blocked") {
          return next.state;
        }
        emit?.({ type: "stage-completed", stage: stage.name, content: "" });
        gatesPassed.push(stage.name);
        i++;
        continue;
      }

      if (stage.role === "qa") {
        const passed = await this.runQaStage(options.adapter);
        if (!passed) {
          return {
            brief,
            runId: options.runId,
            lane: options.lane,
            currentStage: stage.name,
            gatesPassed,
            rejectionCount,
            status: "blocked",
          };
        }
        emit?.({ type: "stage-completed", stage: stage.name, content: "" });
        gatesPassed.push(stage.name);
        i++;
        continue;
      }

      if (stage.role === "librarian") {
        return await this.executeLibrarianStep(
          stage,
          options,
          artifacts,
          featureBranch,
          gatesPassed,
          rejectionCount,
          stagesBrief,
          brief,
          emit
        );
      }

      const result = await this.runDefaultStage(
        stage,
        options.runtime,
        options.runId,
        artifacts,
        options.repoPath,
        options.saveArtifact,
        stagesBrief
      );
      if (result.type === "blocked") {
        return {
          brief,
          runId: options.runId,
          lane: options.lane,
          currentStage: stage.name,
          gatesPassed,
          rejectionCount,
          status: "blocked",
        };
      }
      emit?.({
        type: "stage-completed",
        stage: stage.name,
        content: result.content,
      });
      artifacts = result.artifacts;
      i++;
    }

    return {
      brief,
      runId: options.runId,
      lane: options.lane,
      currentStage: "terminal",
      gatesPassed,
      rejectionCount,
      status: "terminal",
    };
  }

  private async executeLibrarianStep(
    stage: StageDefinition,
    options: RunOptions,
    artifacts: Record<string, string>,
    featureBranch: string,
    gatesPassed: string[],
    rejectionCount: number,
    stagesBrief: Brief | undefined,
    brief: Brief | undefined,
    emit: RunOptions["onProgress"]
  ): Promise<RunState> {
    const approved = await this.runLibrarianStage(
      stage,
      options.runtime,
      options.runId,
      artifacts,
      options.repoPath,
      featureBranch,
      options.mergeGate,
      options.saveArtifact,
      stagesBrief
    );
    if (!approved) {
      return {
        brief,
        runId: options.runId,
        lane: options.lane,
        currentStage: stage.name,
        gatesPassed,
        rejectionCount,
        status: "blocked",
        featureBranch,
      };
    }
    emit?.({ type: "stage-completed", stage: stage.name, content: "" });
    gatesPassed.push(stage.name);
    return {
      brief,
      runId: options.runId,
      lane: options.lane,
      currentStage: "terminal",
      gatesPassed,
      rejectionCount,
      status: "merged",
      featureBranch,
    };
  }

  private applyReviewOutcome(
    outcome: ReviewOutcome,
    stageName: string,
    options: RunOptions,
    gatesPassed: string[],
    brief?: Brief
  ):
    | {
        type: "loopback";
        artifacts: Record<string, string>;
        rejectionCount: number;
        toIndex: number;
      }
    | { type: "blocked"; state: RunState }
    | { type: "passed" } {
    if (outcome.type === "loopback") {
      return outcome;
    }
    if (outcome.type === "blocked") {
      return {
        type: "blocked",
        state: {
          brief,
          runId: options.runId,
          lane: options.lane,
          currentStage: stageName,
          gatesPassed,
          rejectionCount: outcome.rejectionCount,
          status: "blocked",
        },
      };
    }
    return { type: "passed" };
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
    saveArtifact: (stageId: string, content: string) => Promise<void>,
    brief?: Brief
  ): Promise<ReviewOutcome> {
    const reviewerArtifacts = { ...artifacts };
    if (repoPath) {
      reviewerArtifacts.diff = await getDiff(repoPath);
    }
    const action = await reviewerRuntime.execute({
      stageId: stage.name,
      runId,
      artifacts: reviewerArtifacts,
      brief,
    });

    if (
      action.type === "review-rejected" &&
      rejectionCount < maxRetries &&
      workerStageIndex >= 0
    ) {
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

  private async runLibrarianStage(
    stage: StageDefinition,
    runtime: AgentRuntime,
    runId: string,
    artifacts: Record<string, string>,
    repoPath: string | undefined,
    featureBranch: string,
    mergeGate: ((runId: string) => Promise<"approve" | "deny">) | undefined,
    saveArtifact: (stageId: string, content: string) => Promise<void>,
    brief?: Brief
  ): Promise<boolean> {
    const action = await runtime.execute({
      stageId: stage.name,
      runId,
      artifacts: { ...artifacts },
      brief,
    });

    if (action.content) {
      await saveArtifact(stage.name, action.content);
    }

    if (repoPath && action.content) {
      await applyEdits(repoPath, [
        { path: "CONTEXT.md", content: action.content },
      ]);
      await commitEdits(repoPath, `Librarian: ${stage.name}`);
    }

    const decision = mergeGate ? await mergeGate(runId) : "deny";
    if (decision !== "approve") {
      return false;
    }

    if (repoPath) {
      await mergeToMain(repoPath, featureBranch);
    }

    return true;
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
    saveArtifact: (stageId: string, content: string) => Promise<void>,
    brief?: Brief
  ): Promise<DefaultStageOutcome> {
    const action = await runtime.execute({
      stageId: stage.name,
      runId,
      artifacts: { ...artifacts },
      brief,
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
    return {
      type: "completed",
      artifacts: updated,
      content: action.content ?? "",
    };
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
      await commitEdits(repoPath, `Worker: ${stage.name}`);
    }
  }
}

async function readDurableContext(
  repoPath: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    result["durable:context"] = await readFile(
      join(repoPath, "CONTEXT.md"),
      "utf-8"
    );
  } catch {
    // no CONTEXT.md — skip
  }
  try {
    result["durable:context-map"] = await readFile(
      join(repoPath, "CONTEXT-MAP.md"),
      "utf-8"
    );
  } catch {
    // no CONTEXT-MAP.md — skip
  }
  return result;
}
