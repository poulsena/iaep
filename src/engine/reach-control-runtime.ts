import { join, resolve, isAbsolute } from "path";
import type { AgentRuntime, AgentAction, StageInput } from "./types";

export class ReachControlRuntime implements AgentRuntime {
  constructor(
    private readonly inner: AgentRuntime,
    private readonly allowedTools: string[],
    private readonly allowedDirs: string[],
    private readonly repoPath?: string
  ) {}

  async execute(input: StageInput): Promise<AgentAction> {
    const action = await this.inner.execute(input);

    if (action.tool && !this.allowedTools.includes(action.tool)) {
      return { type: "blocked", content: `tool "${action.tool}" is not allowed` };
    }

    for (const edit of action.edits ?? []) {
      const abs = resolve(this.repoPath && !isAbsolute(edit.path) ? join(this.repoPath, edit.path) : edit.path);
      if (!this.allowedDirs.some(dir => abs.startsWith(dir + "/") || abs === dir)) {
        return { type: "blocked", content: `path "${edit.path}" is outside allowed scope` };
      }
    }

    return action;
  }
}
