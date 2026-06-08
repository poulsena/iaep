import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BuildResult, ExecutionAdapter, TestResult } from "./types";

const exec = promisify(execFile);

interface ExecError extends Error {
  stderr?: string;
  stdout?: string;
}

export class Wsl2ExecutionAdapter implements ExecutionAdapter {
  constructor(
    private readonly options: {
      repoPath: string;
      buildCommand: string[];
      testCommand: string[];
    }
  ) {}

  build(): Promise<BuildResult> {
    return this.run(this.options.buildCommand);
  }

  test(): Promise<TestResult> {
    return this.run(this.options.testCommand);
  }

  private async run(
    command: string[]
  ): Promise<{ output: string; success: boolean }> {
    const [cmd, ...args] = command;
    try {
      const { stdout, stderr } = await exec(cmd, args, {
        cwd: this.options.repoPath,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { output: stdout + stderr, success: true };
    } catch (err) {
      const e = err as ExecError;
      return { output: (e.stdout ?? "") + (e.stderr ?? ""), success: false };
    }
  }
}
