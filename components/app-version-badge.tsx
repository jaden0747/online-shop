"use client";

import { useEffect, useState } from "react";

export function AppVersionBadge() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setVersion);
    } else {
      fetch("/api/app-version")
        .then((r) => r.json())
        .then((d) => setVersion(d.version))
        .catch(() => setVersion(null));
    }
  }, []);

  if (!version) return null;

  return (
    <span
      data-testid="app-version-badge"
      className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full"
    >
      v{version}
    </span>
  );
}
