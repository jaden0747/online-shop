"use client";
import { useState, useEffect } from "react";

const STORAGE_KEY = "tableDisplaySettings";

export interface TableSettings {
  zebraStripe: boolean;
  stickyHeader: boolean;
}

const DEFAULTS: TableSettings = { zebraStripe: false, stickyHeader: false };

export function useTableSettings() {
  const [settings, setSettings] = useState<TableSettings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function toggle(key: keyof TableSettings) {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  return { ...settings, toggle };
}
