import { readRows, writeRows } from "./excel";
import type { Settings } from "./types";

const FILE = "settings.xlsx";
const SHEET = "Settings";

const DEFAULTS: Settings = { hubLat: 10.7769, hubLng: 106.7009, mealPriceCutting: 50000, mealPriceMaintenance: 50000, mealPriceBulking: 50000, mealPriceKeto: 50000 };

function parseNum(r: Record<string, unknown>, key: string, fallback: number): number {
  const v = r[key];
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

export function getSettings(): Settings {
  const rows = readRows<Record<string, unknown>>(FILE, SHEET);
  if (rows.length === 0) return DEFAULTS;
  const r = rows[0];
  return {
    hubLat: parseNum(r, "hubLat", DEFAULTS.hubLat),
    hubLng: parseNum(r, "hubLng", DEFAULTS.hubLng),
    mealPriceCutting: parseNum(r, "mealPriceCutting", DEFAULTS.mealPriceCutting),
    mealPriceMaintenance: parseNum(r, "mealPriceMaintenance", DEFAULTS.mealPriceMaintenance),
    mealPriceBulking: parseNum(r, "mealPriceBulking", DEFAULTS.mealPriceBulking),
    mealPriceKeto: parseNum(r, "mealPriceKeto", DEFAULTS.mealPriceKeto),
  };
}

export function getMealPriceForGoal(settings: Settings, goal: string): number {
  const key = `mealPrice${goal.charAt(0).toUpperCase() + goal.slice(1)}` as keyof Settings;
  return (settings[key] as number) || 0;
}

export function getMealPrices(settings: Settings): Record<string, number> {
  return {
    cutting: settings.mealPriceCutting,
    maintenance: settings.mealPriceMaintenance,
    bulking: settings.mealPriceBulking,
    keto: settings.mealPriceKeto,
  };
}

export function saveSettings(settings: Settings): void {
  writeRows(FILE, SHEET, [settings]);
}
