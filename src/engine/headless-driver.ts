import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { InFlightStore } from "./inflight-store";
import { NoopAgentRuntime } from "./noop-agent-runtime";
import { ReachControlRuntime } from "./reach-control-runtime";
import type {
  AgentRuntime,
  AuditEntry,
  RunState,
  StageDefinition,
  StartRunOptions,
} from "./types";
import { WorkflowEngine } from "./workflow-engine";

const NOOP_RUNTIME = new NoopAgentRuntime();

export class HeadlessDriver {
  private readonly engine = new WorkflowEngine();
  private readonly store: InFlightStore;
  private readonly baseDir: string;

  constructor(options: { baseDir: string }) {
    this.baseDir = options.baseDir;
    this.store = new InFlightStore(options.baseDir);
  }

  async startRun(options: StartRunOptions): Promise<RunState> {
    const runId = crypto.randomUUID();
    let runtime: AgentRuntime = options.runtime ?? NOOP_RUNTIME;
    let reviewerRuntime = options.reviewerRuntime;

    if (options.reachControl) {
      const allowedDirs = [
        ...(options.repoPath ? [options.repoPath] : []),
        this.baseDir,
      ];
      const gatedTools = options.reachControl.gatedTools ?? [];
      const approver = options.approver;
      const auditPath = join(
        this.baseDir,
        options.repoKey,
        "runs",
        runId,
        "audit.log"
      );
      const onAudit = async (entry: AuditEntry) => {
        await mkdir(join(this.baseDir, options.repoKey, "runs", runId), {
          recursive: true,
        });
        await appendFile(auditPath, `${JSON.stringify(entry)}\n`);
      };
      runtime = new ReachControlRuntime(
        runtime,
        options.reachControl.allowedTools,
        allowedDirs,
        options.repoPath,
        gatedTools,
        approver,
        onAudit
      );
      if (reviewerRuntime) {
        reviewerRuntime = new ReachControlRuntime(
          reviewerRuntime,
          options.reachControl.allowedTools,
          allowedDirs,
          options.repoPath,
          gatedTools,
          approver,
          onAudit
        );
      }
    }

    const state = await this.engine.run({
      runId,
      lane: options.lane,
      stages: options.stages,
      runtime,
      reviewerRuntime,
      adapter: options.adapter,
      repoPath: options.repoPath,
      branchType: options.branchType,
      maxRetries: options.maxRetries,
      saveArtifact: (stageId, content) =>
        this.store.saveArtifact(options.repoKey, runId, stageId, content),
    });
    await this.store.save(options.repoKey, runId, state);
    return state;
  }

  async resumeRun(options: {
    repoKey: string;
    runId: string;
    stages: StageDefinition[];
    runtime?: AgentRuntime;
    reviewerRuntime?: AgentRuntime;
    decision: "approved" | "denied";
  }): Promise<RunState> {
    const parked = await this.store.load(options.repoKey, options.runId);
    if (parked?.status !== "blocked") {
      throw new Error(`run ${options.runId} is not in a blocked state`);
    }

    if (options.decision === "denied") {
      return parked;
    }

    const escalationIndex = options.stages.findIndex(
      (s) => s.name === parked.currentStage
    );
    const startIndex = escalationIndex >= 0 ? escalationIndex + 1 : 0;
    const initialGatesPassed = [
      ...parked.gatesPassed,
      ...(escalationIndex >= 0 ? [parked.currentStage] : []),
    ];

    const artifacts = await this.store.loadAllArtifacts(
      options.repoKey,
      options.runId
    );

    const runtime = options.runtime ?? NOOP_RUNTIME;
    const state = await this.engine.run({
      runId: options.runId,
      lane: parked.lane,
      stages: options.stages,
      runtime,
      reviewerRuntime: options.reviewerRuntime,
      startIndex,
      initialArtifacts: artifacts,
      initialGatesPassed,
      initialRejectionCount: parked.rejectionCount,
      saveArtifact: (stageId, content) =>
        this.store.saveArtifact(
          options.repoKey,
          options.runId,
          stageId,
          content
        ),
    });
    await this.store.save(options.repoKey, options.runId, state);
    return state;
  }
}
