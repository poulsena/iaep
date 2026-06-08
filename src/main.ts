import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { ClaudeAgentRuntime } from "./engine/claude-agent-runtime";
import { HeadlessDriver } from "./engine/headless-driver";
import { IpcDriverBridge } from "./main/ipc-driver-bridge";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(import.meta.dirname, "../preload/index.js"),
    },
  });

  const driver = new HeadlessDriver({
    baseDir: path.join(app.getPath("userData"), "iaep"),
  });
  const plannerRuntime = new ClaudeAgentRuntime({
    model: "claude-opus-4-8",
    systemPrompt:
      'You are an expert software engineer. Diagnose the problem or plan the change described in the brief. Produce a clear, concise analysis. Respond with JSON: {"type":"completed","content":"Your analysis."}',
  });
  const implementerRuntime = new ClaudeAgentRuntime({
    model: "claude-sonnet-4-6",
    systemPrompt:
      'You are an expert software engineer. Implement the requested change precisely. Respond with JSON: {"type":"edit","edits":[{"path":"...","content":"..."}],"content":"Summary of changes made."}',
  });
  const reviewerRuntime = new ClaudeAgentRuntime({
    model: "claude-opus-4-8",
    systemPrompt:
      'You are a careful code reviewer. Review the diff provided. Respond with JSON: {"type":"review-passed","content":"Looks good."} or {"type":"review-rejected","content":"Reason for rejection."}',
  });
  new IpcDriverBridge(
    driver,
    ipcMain,
    win.webContents,
    plannerRuntime,
    reviewerRuntime,
    implementerRuntime
  );

  ipcMain.handle("iaep:show-directory-dialog", async () => {
    const { filePaths } = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    return filePaths[0] ?? undefined;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(import.meta.dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
