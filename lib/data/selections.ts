import { readRows, writeRows, toStr, toNum } from "./excel";
import type { MealSelection } from "./types";

const FILE = "selections.xlsx";
const SHEET = "Selections";

function parse(raw: Record<string, unknown>): MealSelection {
  return {
    id: toStr(raw.id),
    weekLabel: toStr(raw.weekLabel),
    customerId: toStr(raw.customerId),
    day: toNum(raw.day),
    mealNum: toNum(raw.mealNum) || 1,
    menuSlot: toNum(raw.menuSlot) || 1,
  };
}

export function getAllSelections(): MealSelection[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((s) => s.id && s.weekLabel && s.customerId && s.day);
}

export function getSelectionsByWeek(weekLabel: string): MealSelection[] {
  return getAllSelections().filter((s) => s.weekLabel === weekLabel);
}

export function saveSelections(selections: MealSelection[]): void {
  writeRows(FILE, SHEET, selections);
}

export function upsertSelection(data: {
  weekLabel: string;
  customerId: string;
  day: number;
  mealNum: number;
  menuSlot: number;
}): MealSelection {
  const all = getAllSelections();
  const id = `${data.weekLabel}-${data.customerId}-${data.day}-${data.mealNum}`;
  const idx = all.findIndex((s) => s.id === id);
  const sel: MealSelection = { ...data, id };
  if (idx >= 0) {
    all[idx] = sel;
  } else {
    all.push(sel);
  }
  saveSelections(all);
  return sel;
}

export function deleteSelection(id: string): void {
  saveSelections(getAllSelections().filter((s) => s.id !== id));
}
