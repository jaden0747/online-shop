import { readRows, writeRows, toStr, toStrOrNull, toNum } from "./excel";
import type { WeeklyOps } from "./types";

const FILE = "operations.xlsx";
const SHEET = "Operations";

function parseOps(raw: Record<string, unknown>): WeeklyOps {
  return {
    id: toStr(raw.id),
    weekLabel: toStr(raw.weekLabel),
    mealsPrepared: toNum(raw.mealsPrepared) || 0,
    mealsDelivered: toNum(raw.mealsDelivered) || 0,
    wastedMeals: toNum(raw.wastedMeals) || 0,
    note: toStrOrNull(raw.note),
    updatedAt: toStr(raw.updatedAt) || new Date().toISOString(),
  };
}

export function getAllWeeklyOps(): WeeklyOps[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parseOps)
    .filter((o) => o.id && o.weekLabel);
}

export function getWeeklyOpsByLabel(weekLabel: string): WeeklyOps | null {
  return getAllWeeklyOps().find((o) => o.weekLabel === weekLabel) ?? null;
}

export function saveWeeklyOps(ops: WeeklyOps[]): void {
  writeRows(FILE, SHEET, ops);
}

export function upsertWeeklyOps(data: {
  weekLabel: string;
  mealsPrepared: number;
  mealsDelivered: number;
  wastedMeals: number;
  note?: string | null;
}): WeeklyOps {
  const all = getAllWeeklyOps();
  const existing = all.find((o) => o.weekLabel === data.weekLabel);
  if (existing) {
    const updated = {
      ...existing,
      mealsPrepared: data.mealsPrepared,
      mealsDelivered: data.mealsDelivered,
      wastedMeals: data.wastedMeals,
      note: data.note ?? existing.note,
      updatedAt: new Date().toISOString(),
    };
    saveWeeklyOps(all.map((o) => (o.weekLabel === data.weekLabel ? updated : o)));
    return updated;
  }
  const created: WeeklyOps = {
    id: data.weekLabel, // natural key = weekLabel
    weekLabel: data.weekLabel,
    mealsPrepared: data.mealsPrepared,
    mealsDelivered: data.mealsDelivered,
    wastedMeals: data.wastedMeals,
    note: data.note ?? null,
    updatedAt: new Date().toISOString(),
  };
  all.push(created);
  saveWeeklyOps(all);
  return created;
}
