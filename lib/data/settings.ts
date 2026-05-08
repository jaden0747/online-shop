import { readRows, writeRows } from "./excel";
import type { Settings } from "./types";

const FILE = "settings.xlsx";
const SHEET = "Settings";

const DEFAULTS: Settings = { hubLat: 10.7769, hubLng: 106.7009 };

export function getSettings(): Settings {
  const rows = readRows<Record<string, unknown>>(FILE, SHEET);
  if (rows.length === 0) return DEFAULTS;
  const r = rows[0];
  const hubLat = r.hubLat !== undefined && r.hubLat !== null && r.hubLat !== "" ? Number(r.hubLat) : DEFAULTS.hubLat;
  const hubLng = r.hubLng !== undefined && r.hubLng !== null && r.hubLng !== "" ? Number(r.hubLng) : DEFAULTS.hubLng;
  return { hubLat: isNaN(hubLat) ? DEFAULTS.hubLat : hubLat, hubLng: isNaN(hubLng) ? DEFAULTS.hubLng : hubLng };
}

export function saveSettings(settings: Settings): void {
  writeRows(FILE, SHEET, [settings]);
}
