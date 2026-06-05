import { app, BrowserWindow } from "electron";

function createWindow(): void {
  const win = new BrowserWindow({ width: 1200, height: 800 });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
