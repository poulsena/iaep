import { describe, expect, test } from "bun:test";
import { Wsl2ExecutionAdapter } from "./wsl2-execution-adapter";

describe("Wsl2ExecutionAdapter", () => {
  test("build returns success when command exits 0", async () => {
    const adapter = new Wsl2ExecutionAdapter({
      repoPath: process.cwd(),
      buildCommand: ["true"],
      testCommand: ["true"],
    });
    const result = await adapter.build();
    expect(result.success).toBe(true);
  });

  test("test returns failure when command exits non-zero", async () => {
    const adapter = new Wsl2ExecutionAdapter({
      repoPath: process.cwd(),
      buildCommand: ["true"],
      testCommand: ["false"],
    });
    const result = await adapter.test();
    expect(result.success).toBe(false);
  });

  test("output is captured from stdout", async () => {
    const adapter = new Wsl2ExecutionAdapter({
      repoPath: process.cwd(),
      buildCommand: ["echo", "hello-build"],
      testCommand: ["true"],
    });
    const result = await adapter.build();
    expect(result.output).toContain("hello-build");
  });
});
