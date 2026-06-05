export type Lane = "quick-change" | "full-feature";
export type BranchType = "feature" | "fix" | "chore" | "refactor" | "docs";

export interface StageDefinition {
  name: string;
  role?: "worker";
}

export interface RunState {
  runId: string;
  lane: Lane;
  currentStage: string;
  gatesPassed: string[];
  status: "running" | "terminal";
}

export interface FileEdit {
  path: string;
  content: string;
}

export interface AgentAction {
  type: string;
  content: string;
  edits?: FileEdit[];
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
  repoPath?: string;
  branchType?: BranchType;
  lane: Lane;
  stages: StageDefinition[];
  runtime?: AgentRuntime;
}
