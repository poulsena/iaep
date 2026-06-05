export type Lane = "quick-change" | "full-feature";
export type BranchType = "feature" | "fix" | "chore" | "refactor" | "docs";

export interface BuildResult {
  success: boolean;
  output: string;
}

export interface TestResult {
  success: boolean;
  output: string;
}

export interface ExecutionAdapter {
  build(): Promise<BuildResult>;
  test(): Promise<TestResult>;
}

export interface StageDefinition {
  name: string;
  role?: "worker" | "qa" | "reviewer";
}

export interface RunState {
  runId: string;
  lane: Lane;
  currentStage: string;
  gatesPassed: string[];
  status: "running" | "terminal" | "blocked";
}

export interface FileEdit {
  path: string;
  content: string;
}

export interface AgentAction {
  type: string;
  content: string;
  tool?: string;
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

export interface ReachControlOptions {
  allowedTools: string[];
}

export interface StartRunOptions {
  repoKey: string;
  repoPath?: string;
  branchType?: BranchType;
  lane: Lane;
  stages: StageDefinition[];
  runtime?: AgentRuntime;
  reviewerRuntime?: AgentRuntime;
  adapter?: ExecutionAdapter;
  reachControl?: ReachControlOptions;
}
