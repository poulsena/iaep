import { access } from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionAdapter } from "./types";
import { Wsl2ExecutionAdapter } from "./wsl2-execution-adapter";

export async function detectConventionalAdapter(
  repoPath: string
): Promise<ExecutionAdapter | undefined> {
  if (await fileExists(join(repoPath, "package.json"))) {
    return new Wsl2ExecutionAdapter({
      repoPath,
      buildCommand: ["bun", "run", "typecheck"],
      testCommand: ["bun", "test"],
    });
  }
  return;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
