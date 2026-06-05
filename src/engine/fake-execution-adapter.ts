import type { BuildResult, ExecutionAdapter, TestResult } from "./types";

export class FakeExecutionAdapter implements ExecutionAdapter {
  constructor(private readonly testResult: TestResult) {}

  build(): Promise<BuildResult> {
    return Promise.resolve({ success: true, output: "" });
  }

  test(): Promise<TestResult> {
    return Promise.resolve(this.testResult);
  }
}
