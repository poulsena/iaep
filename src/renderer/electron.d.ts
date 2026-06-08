interface ElectronIpc {
  invoke(channel: string, data?: unknown): Promise<unknown>;
  on(channel: string, listener: (event: unknown, data: unknown) => void): void;
  send(channel: string, data: unknown): void;
  showDirectoryDialog(): Promise<string | undefined>;
}

interface Window {
  electronIpc: ElectronIpc;
}
