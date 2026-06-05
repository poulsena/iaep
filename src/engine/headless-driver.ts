import { WorkflowEngine } from "./workflow-engine";
import { InFlightStore } from "./inflight-store";
import { NoopAgentRuntime } from "./noop-agent-runtime";
import type { StartRunOptions, RunState } from "./types";

const NOOP_RUNTIME = new NoopAgentRuntime();

export class HeadlessDriver {
  private readonly engine = new WorkflowEngine();
  private readonly store: InFlightStore;

  constructor(options: { baseDir: string }) {
    this.store = new InFlightStore(options.baseDir);
  }

  async startRun(options: StartRunOptions): Promise<RunState> {
    const runId = crypto.randomUUID();
    const runtime = options.runtime ?? NOOP_RUNTIME;
    const state = await this.engine.run({
      runId,
      lane: options.lane,
      stages: options.stages,
      runtime,
      saveArtifact: (stageId, content) =>
        this.store.saveArtifact(options.repoKey, runId, stageId, content),
    });
    await this.store.save(options.repoKey, runId, state);
    return state;
  }
}
