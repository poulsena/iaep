import { WorkflowEngine } from "./workflow-engine";
import { InFlightStore } from "./inflight-store";
import { NoopAgentRuntime } from "./noop-agent-runtime";
import { ReachControlRuntime } from "./reach-control-runtime";
import type { StartRunOptions, RunState, AgentRuntime } from "./types";

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
      runtime = new ReachControlRuntime(runtime, options.reachControl.allowedTools, allowedDirs, options.repoPath);
      if (reviewerRuntime) {
        reviewerRuntime = new ReachControlRuntime(reviewerRuntime, options.reachControl.allowedTools, allowedDirs, options.repoPath);
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
