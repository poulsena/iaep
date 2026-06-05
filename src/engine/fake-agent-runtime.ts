import type { AgentAction, AgentRuntime, StageInput } from "./types";

export class FakeAgentRuntime implements AgentRuntime {
  constructor(private readonly script: Record<string, AgentAction>) {}

  execute(input: StageInput): Promise<AgentAction> {
    const action = this.script[input.stageId];
    if (!action) {
      return Promise.resolve({ type: "noop", content: "" });
    }
    return Promise.resolve(action);
  }
}

export class SequencedFakeAgentRuntime implements AgentRuntime {
  private readonly counters: Record<string, number> = {};

  constructor(private readonly script: Record<string, AgentAction[]>) {}

  execute(input: StageInput): Promise<AgentAction> {
    const sequence = this.script[input.stageId];
    if (!sequence?.length) {
      return Promise.resolve({ type: "noop", content: "" });
    }
    const i = this.counters[input.stageId] ?? 0;
    this.counters[input.stageId] = i + 1;
    return Promise.resolve(sequence[Math.min(i, sequence.length - 1)]);
  }
}

export class CapturingSequencedRuntime extends SequencedFakeAgentRuntime {
  private readonly captured: Record<string, StageInput[]> = {};

  execute(input: StageInput): Promise<AgentAction> {
    if (!this.captured[input.stageId]) {
      this.captured[input.stageId] = [];
    }
    this.captured[input.stageId].push(input);
    return super.execute(input);
  }

  inputsFor(stageId: string): StageInput[] {
    return this.captured[stageId] ?? [];
  }
}
