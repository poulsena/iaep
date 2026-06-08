import { expect, test } from "bun:test";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

import { ClaudeAgentRuntime } from "./claude-agent-runtime";
import type { StageInput } from "./types";

const STAGE_INPUT: StageInput = {
  runId: "integration-run-1",
  stageId: "test-stage",
  artifacts: {},
};

const SYSTEM_PROMPT =
  'You are a test agent. Output ONLY raw JSON, no markdown, no code blocks, no backticks. Respond with exactly: {"type":"noop","content":"ok"}';

const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
const hasBedrockCreds =
  !!process.env.AWS_REGION &&
  !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE);

test.skipIf(!hasAnthropicKey)(
  "direct: returns AgentAction from a real Claude session",
  async () => {
    const runtime = new ClaudeAgentRuntime({ systemPrompt: SYSTEM_PROMPT });
    const action = await runtime.execute(STAGE_INPUT);
    expect(typeof action.type).toBe("string");
    expect(action.content.length).toBeGreaterThan(0);
  }
);

test.skipIf(!hasBedrockCreds)(
  "bedrock: returns AgentAction through the seam",
  async () => {
    const client = new AnthropicBedrock();
    const runtime = new ClaudeAgentRuntime({
      client,
      model: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
      systemPrompt: SYSTEM_PROMPT,
    });
    const action = await runtime.execute(STAGE_INPUT);
    expect(typeof action.type).toBe("string");
    expect(action.content.length).toBeGreaterThan(0);
  }
);
