import { readRows, writeRows, toStr, toNum } from "./excel";
import type { Pricing } from "./types";

const FILE = "pricing.xlsx";
const SHEET = "Pricing";

function parsePricing(raw: Record<string, unknown>): Pricing {
  const plan = toStr(raw.plan);
  const goal = toStr(raw.goal);
  const mealsPerDay = toNum(raw.mealsPerDay) || 1;
  return {
    id: `${plan}-${goal}-${mealsPerDay}`,
    plan,
    goal,
    mealsPerDay,
    totalPrice: toNum(raw.totalPrice),
  };
}

export function getAllPricing(): Pricing[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parsePricing)
    .filter((p) => p.plan && p.goal);
}

export function savePricing(entries: Pricing[]): void {
  writeRows(FILE, SHEET, entries.map(({ id: _id, ...rest }) => rest));
}

export function upsertPricing(data: {
  plan: string;
  goal: string;
  mealsPerDay: number;
  totalPrice: number;
}): void {
  const entries = getAllPricing();
  const idx = entries.findIndex(
    (p) => p.plan === data.plan && p.goal === data.goal && p.mealsPerDay === data.mealsPerDay
  );
  const entry: Pricing = {
    id: `${data.plan}-${data.goal}-${data.mealsPerDay}`,
    ...data,
  };
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  savePricing(entries);
}

export function deletePricing(id: string): void {
  savePricing(getAllPricing().filter((p) => p.id !== id));
}
