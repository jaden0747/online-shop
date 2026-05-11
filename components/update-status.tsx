"use client";

import { useEffect, useState } from "react";
import type { UpdateStatus } from "@/electron/electron.d";

type Status = UpdateStatus | null;

export function AppUpdateStatus() {
  const [status, setStatus] = useState<Status>(null);
  const [installing, setInstalling] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;
    setIsElectron(true);
    const unsub = window.electronAPI.onUpdateStatus(setStatus);
    window.electronAPI.checkForUpdates();
    return unsub;
  }, []);

  if (!isElectron || !status) return null;

  if (status.type === "checking") {
    return (
      <span
        data-testid="update-status-checking"
        className="text-xs text-muted-foreground animate-pulse"
      >
        Checking for updates…
      </span>
    );
  }

  if (status.type === "not-available") {
    return (
      <span
        data-testid="update-status-up-to-date"
        className="text-xs text-green-600 dark:text-green-400"
      >
        Up to date
      </span>
    );
  }

  if (status.type === "available") {
    return (
      <span
        data-testid="update-status-available"
        className="text-xs text-orange-500 font-medium"
      >
        Update available (v{status.version}) — downloading…
      </span>
    );
  }

  if (status.type === "downloading") {
    return (
      <span
        data-testid="update-status-downloading"
        className="text-xs text-muted-foreground"
      >
        Downloading update… {status.percent}%
      </span>
    );
  }

  if (status.type === "downloaded") {
    return (
      <button
        data-testid="update-status-install-btn"
        onClick={async () => {
          setInstalling(true);
          await window.electronAPI!.installUpdate();
        }}
        disabled={installing}
        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-0.5 rounded-full font-medium disabled:opacity-60 transition-colors"
      >
        {installing ? "Restarting…" : `Install v${status.version} & Restart`}
      </button>
    );
  }

  if (status.type === "error") {
    return (
      <span
        data-testid="update-status-error"
        className="text-xs text-red-500"
        title={status.message}
      >
        Update error
      </span>
    );
  }

  return null;
}
