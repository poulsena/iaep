import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { InFlightStore } from "./inflight-store";
import { NoopAgentRuntime } from "./noop-agent-runtime";
import { ReachControlRuntime } from "./reach-control-runtime";
import type {
  AgentRuntime,
  AuditEntry,
  RunState,
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
      saveArtifact: (stageId, content) =>
        this.store.saveArtifact(options.repoKey, runId, stageId, content),
    });
    await this.store.save(options.repoKey, runId, state);
    return state;
  }
}
