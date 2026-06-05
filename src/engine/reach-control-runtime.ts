import { isAbsolute, join, resolve } from "node:path";
import type {
  AgentAction,
  AgentRuntime,
  AuditEntry,
  StageInput,
} from "./types";

export class ReachControlRuntime implements AgentRuntime {
  constructor(
    private readonly inner: AgentRuntime,
    private readonly allowedTools: string[],
    private readonly allowedDirs: string[],
    private readonly repoPath?: string,
    private readonly gatedTools: string[] = [],
    private readonly onApproval?: (
      stageId: string,
      action: AgentAction
    ) => Promise<"approve" | "deny">,
    private readonly onAudit?: (entry: AuditEntry) => Promise<void>
  ) {}

  async execute(input: StageInput): Promise<AgentAction> {
    const action = await this.inner.execute(input);

    if (action.tool && !this.allowedTools.includes(action.tool)) {
      await this.audit(input, action, "blocked");
      return {
        type: "blocked",
        content: `tool "${action.tool}" is not allowed`,
      };
    }

    for (const edit of action.edits ?? []) {
      const abs = resolve(
        this.repoPath && !isAbsolute(edit.path)
          ? join(this.repoPath, edit.path)
          : edit.path
      );
      if (
        !this.allowedDirs.some(
          (dir) => abs.startsWith(`${dir}/`) || abs === dir
        )
      ) {
        await this.audit(input, action, "blocked");
        return {
          type: "blocked",
          content: `path "${edit.path}" is outside allowed scope`,
        };
      }
    }

    if (action.tool && this.gatedTools.includes(action.tool)) {
      const decision = this.onApproval
        ? await this.onApproval(input.stageId, action)
        : "deny";
      if (decision === "deny") {
        await this.audit(input, action, "denied");
        return {
          type: "blocked",
          content: `tool "${action.tool}" was denied by approver`,
        };
      }
      await this.audit(input, action, "approved");
      return action;
    }

    await this.audit(input, action, "allowed");
    return action;
  }

  private async audit(
    input: StageInput,
    action: AgentAction,
    decision: AuditEntry["decision"]
  ): Promise<void> {
    if (!this.onAudit) {
      return;
    }
    await this.onAudit({
      timestamp: new Date().toISOString(),
      runId: input.runId,
      stageId: input.stageId,
      tool: action.tool,
      decision,
    });
  }
}
