export type Lane = "quick-change" | "full-feature";
export type BranchType = "feature" | "fix" | "chore" | "refactor" | "docs";

export interface BuildResult {
  output: string;
  success: boolean;
}

export interface TestResult {
  output: string;
  success: boolean;
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
  currentStage: string;
  gatesPassed: string[];
  lane: Lane;
  rejectionCount: number;
  runId: string;
  status: "running" | "terminal" | "blocked";
}

export interface FileEdit {
  content: string;
  path: string;
}

export interface AgentAction {
  content: string;
  edits?: FileEdit[];
  tool?: string;
  type: string;
}

export interface StageInput {
  artifacts: Record<string, string>;
  runId: string;
  stageId: string;
}

export interface AgentRuntime {
  execute(input: StageInput): Promise<AgentAction>;
}

export interface AuditEntry {
  decision: "allowed" | "approved" | "denied" | "blocked";
  runId: string;
  stageId: string;
  timestamp: string;
  tool?: string;
}

export interface ReachControlOptions {
  allowedTools: string[];
  gatedTools?: string[];
}

export interface StartRunOptions {
  adapter?: ExecutionAdapter;
  approver?: (
    stageId: string,
    action: AgentAction
  ) => Promise<"approve" | "deny">;
  branchType?: BranchType;
  lane: Lane;
  reachControl?: ReachControlOptions;
  repoKey: string;
  repoPath?: string;
  reviewerRuntime?: AgentRuntime;
  runtime?: AgentRuntime;
  stages: StageDefinition[];
}
