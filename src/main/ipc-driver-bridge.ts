import type { HeadlessDriver } from "../engine/headless-driver";
import type { ProgressEvent, StartRunOptions } from "../engine/types";

type DriverLike = Pick<HeadlessDriver, "startRun" | "resumeRun">;

interface IpcMainLike {
  handle(
    channel: string,
    handler: (event: unknown, data: unknown) => Promise<unknown>
  ): void;
  once(
    channel: string,
    listener: (event: unknown, data: unknown) => void
  ): void;
}

interface WebContentsLike {
  send(channel: string, data: unknown): void;
}

type StartRunPayload = Pick<
  StartRunOptions,
  "repoKey" | "lane" | "stages" | "repoPath" | "branchType" | "maxRetries"
>;

export class IpcDriverBridge {
  constructor(
    private readonly driver: DriverLike,
    private readonly ipc: IpcMainLike,
    private readonly webContents: WebContentsLike
  ) {
    this.register();
  }

  private register(): void {
    this.ipc.handle("iaep:start-run", async (_event, data) => {
      const payload = data as StartRunPayload;
      const state = await this.driver.startRun({
        ...payload,
        onProgress: (e: ProgressEvent) =>
          this.webContents.send("iaep:run-progress", e),
        mergeGate: () => this.awaitGateDecision("merge"),
      });
      const completed: ProgressEvent = { type: "run-completed", state };
      this.webContents.send("iaep:run-progress", completed);
    });
  }

  private awaitGateDecision(
    gateType: "approval" | "merge"
  ): Promise<"approve" | "deny"> {
    const event: ProgressEvent = { type: "gate", gateType };
    this.webContents.send("iaep:run-progress", event);
    return new Promise((resolve) => {
      this.ipc.once("iaep:gate-decision", (_event, decision) => {
        resolve(decision as "approve" | "deny");
      });
    });
  }
}
