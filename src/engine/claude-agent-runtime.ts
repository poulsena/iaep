import Anthropic from "@anthropic-ai/sdk";
import type { AgentAction, AgentRuntime, StageInput } from "./types";

interface MessagesClient {
  messages: Pick<Anthropic["messages"], "create">;
}

interface ClaudeAgentRuntimeOptions {
  client?: MessagesClient;
  model?: string;
  systemPrompt: string;
}

export class ClaudeAgentRuntime implements AgentRuntime {
  private readonly client: MessagesClient;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(options: ClaudeAgentRuntimeOptions) {
    this.client = options.client ?? new Anthropic();
    this.model = options.model ?? "claude-haiku-4-5";
    this.systemPrompt = options.systemPrompt;
  }

  async execute(input: StageInput): Promise<AgentAction> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.systemPrompt,
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type !== "text") {
      throw new Error("No text block in Claude response");
    }

    return JSON.parse(stripCodeFences(textBlock.text)) as AgentAction;
  }
}

const CODE_FENCE_RE = /^```[\w]*\n?([\s\S]*?)```\s*$/;

function stripCodeFences(text: string): string {
  return text.replace(CODE_FENCE_RE, "$1").trim();
}

function buildUserMessage(input: StageInput): string {
  const parts = [`Stage: ${input.stageId}`, `Run: ${input.runId}`];

  const entries = Object.entries(input.artifacts);
  if (entries.length > 0) {
    parts.push("Artifacts:");
    for (const [key, value] of entries) {
      parts.push(`## ${key}\n${value}`);
    }
  }

  return parts.join("\n\n");
}
