import type { ExecutionAdapter, TestResult, BuildResult } from "./types";

export class FakeExecutionAdapter implements ExecutionAdapter {
  constructor(private readonly testResult: TestResult) {}

  async build(): Promise<BuildResult> {
    return { success: true, output: "" };
  }

  async test(): Promise<TestResult> {
    return this.testResult;
  }
}
