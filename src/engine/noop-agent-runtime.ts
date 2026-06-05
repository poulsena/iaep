import type { AgentRuntime, AgentAction, StageInput } from "./types";

export class NoopAgentRuntime implements AgentRuntime {
  async execute(_input: StageInput): Promise<AgentAction> {
    return { type: "noop", content: "" };
  }
}
