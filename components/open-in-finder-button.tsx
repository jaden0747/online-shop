"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export function OpenInFinderButton({ file, label }: { file: string; label?: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      setError(null);
      if (window.electronAPI?.openDataFolder) {
        await window.electronAPI.openDataFolder();
        return;
      }
      const res = await fetch("/api/open-data-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file }),
      });
      if (!res.ok) setError("Could not open file");
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending} title={`Open ${file} in Finder`}>
      <FolderOpen size={13} className="mr-1" />
      {label ?? "Open in Finder"}
      {error && <span className="ml-1 text-destructive text-xs">{error}</span>}
    </Button>
  );
}
