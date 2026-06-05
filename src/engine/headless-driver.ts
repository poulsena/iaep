import { WorkflowEngine } from "./workflow-engine";
import { InFlightStore } from "./inflight-store";
import type { StartRunOptions, RunState } from "./types";

export class HeadlessDriver {
  private readonly engine = new WorkflowEngine();
  private readonly store: InFlightStore;

  constructor(options: { baseDir: string }) {
    this.store = new InFlightStore(options.baseDir);
  }

  async startRun(options: StartRunOptions): Promise<RunState> {
    const runId = crypto.randomUUID();
    const state = this.engine.run({ runId, lane: options.lane, stages: options.stages });
    await this.store.save(options.repoKey, runId, state);
    return state;
  }
}
