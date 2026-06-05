import type { AgentRuntime, AgentAction, StageInput } from "./types";

export class FakeAgentRuntime implements AgentRuntime {
  constructor(private readonly script: Record<string, AgentAction>) {}

  async execute(input: StageInput): Promise<AgentAction> {
    const action = this.script[input.stageId];
    if (!action) {
      return { type: "noop", content: "" };
    }
    return action;
  }
}
