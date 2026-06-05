import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { BranchType, FileEdit } from "./types";

const exec = promisify(execFile);

export async function createFeatureBranch(
  repoPath: string,
  branchType: BranchType,
  runId: string
): Promise<void> {
  await exec("git", ["checkout", "-b", `${branchType}/${runId}`], {
    cwd: repoPath,
  });
}

export async function applyEdits(
  repoPath: string,
  edits: FileEdit[]
): Promise<void> {
  for (const edit of edits) {
    const fullPath = join(repoPath, edit.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, edit.content);
  }
}

export async function commitEdits(
  repoPath: string,
  message: string
): Promise<void> {
  await exec("git", ["add", "."], { cwd: repoPath });
  await exec("git", ["commit", "-m", message], { cwd: repoPath });
}

export async function mergeToMain(
  repoPath: string,
  featureBranch: string
): Promise<void> {
  await exec("git", ["checkout", "main"], { cwd: repoPath });
  await exec("git", ["merge", "--no-ff", featureBranch, "-m", `Merge ${featureBranch}`], {
    cwd: repoPath,
  });
}

export async function getDiff(repoPath: string): Promise<string> {
  try {
    const { stdout } = await exec("git", ["diff", "main...HEAD"], {
      cwd: repoPath,
    });
    return stdout;
  } catch {
    return "";
  }
}
