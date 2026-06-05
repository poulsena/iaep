import type { AgentAction, AgentRuntime, StageInput } from "./types";

export class NoopAgentRuntime implements AgentRuntime {
  execute(_input: StageInput): Promise<AgentAction> {
    return Promise.resolve({ type: "noop", content: "" });
  }
}
