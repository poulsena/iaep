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
