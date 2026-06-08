import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronIpc", {
  invoke: (channel: string, data?: unknown) =>
    ipcRenderer.invoke(channel, data),
  on: (channel: string, listener: (event: unknown, data: unknown) => void) => {
    ipcRenderer.on(channel, listener);
  },
  send: (channel: string, data: unknown) => ipcRenderer.send(channel, data),
  showDirectoryDialog: (): Promise<string | undefined> =>
    ipcRenderer.invoke("iaep:show-directory-dialog"),
});
