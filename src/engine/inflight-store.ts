import { join } from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import type { RunState } from "./types";

export class InFlightStore {
  constructor(private readonly baseDir: string) {}

  async save(repoKey: string, runId: string, state: RunState): Promise<void> {
    const dir = join(this.baseDir, repoKey, "runs", runId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "run.json"), JSON.stringify(state, null, 2));
  }

  async load(repoKey: string, runId: string): Promise<RunState | null> {
    const path = join(this.baseDir, repoKey, "runs", runId, "run.json");
    try {
      const content = await readFile(path, "utf-8");
      return JSON.parse(content) as RunState;
    } catch {
      return null;
    }
  }

  runPath(repoKey: string, runId: string): string {
    return join(this.baseDir, repoKey, "runs", runId, "run.json");
  }
}
