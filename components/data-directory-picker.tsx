"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export function DataDirectoryPicker() {
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [pending, setPending] = useState(false);
  const [restartPrompt, setRestartPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    setIsElectron(true);
    window.electronAPI.getDataDirectory().then(setCurrentDir);
  }, []);

  if (!isElectron) {
    return (
      <p className="text-sm text-muted-foreground">
        Data directory selection is only available in the desktop app.
      </p>
    );
  }

  async function handleSelect() {
    setPending(true);
    setError(null);
    try {
      const result = await window.electronAPI!.selectDataDirectory();
      if (result && typeof result === "object" && "error" in result) {
        setError(result.error as string);
      } else if (result) {
        setCurrentDir(result as string);
        setRestartPrompt(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="data-directory-picker">
      <div className="text-sm space-y-1">
        <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">
          Current directory
        </p>
        <p
          data-testid="data-directory-path"
          className="font-mono text-sm break-all bg-muted px-3 py-2 rounded-md"
        >
          {currentDir ?? "Loading…"}
        </p>
      </div>

      <Button
        data-testid="data-directory-change-btn"
        variant="outline"
        size="sm"
        onClick={handleSelect}
        disabled={pending}
      >
        <FolderOpen size={15} className="mr-1.5" />
        {pending ? "Selecting…" : "Change Directory"}
      </Button>

      {restartPrompt && (
        <p
          data-testid="data-directory-restart-prompt"
          className="text-xs text-orange-500"
        >
          Restart the app for the new directory to take effect.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
