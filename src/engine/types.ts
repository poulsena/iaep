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

export interface StartRunOptions {
  repoKey: string;
  lane: Lane;
  stages: StageDefinition[];
}
