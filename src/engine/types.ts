export type Lane = "quick-change" | "full-feature";

export interface StageDefinition {
  name: string;
}

export interface RunState {
  runId: string;
  lane: Lane;
  currentStage: string;
  gatesPassed: string[];
  status: "running" | "terminal";
}

export interface AgentAction {
  type: string;
  content: string;
}

export interface StageInput {
  stageId: string;
  runId: string;
  artifacts: Record<string, string>;
}

export interface AgentRuntime {
  execute(input: StageInput): Promise<AgentAction>;
}

export interface StartRunOptions {
  repoKey: string;
  lane: Lane;
  stages: StageDefinition[];
  runtime?: AgentRuntime;
}
