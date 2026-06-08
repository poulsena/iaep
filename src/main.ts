import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
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
  new IpcDriverBridge(driver, ipcMain, win.webContents);

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
