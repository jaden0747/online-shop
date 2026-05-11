export type UpdateStatus =
  | { type: "checking" }
  | { type: "available"; version: string }
  | { type: "not-available" }
  | { type: "downloading"; percent: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  selectDataDirectory: () => Promise<string | { error: string } | null>;
  getDataDirectory: () => Promise<string>;
  openDataFolder: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
