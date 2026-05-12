import { readRows, writeRows, toStr, toStrOrNull, toNum } from "./excel";
import type { CostItem } from "./types";

const FILE = "cost-items.xlsx";
const SHEET = "Items";

function parseCostItem(raw: Record<string, unknown>): CostItem {
  return {
    id: toStr(raw.id),
    weekLabel: toStr(raw.weekLabel),
    categoryId: toStr(raw.categoryId),
    amount: toNum(raw.amount),
    note: toStrOrNull(raw.note),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllCostItems(): CostItem[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parseCostItem)
    .filter((c) => c.id && c.weekLabel && c.categoryId);
}

export function getCostItemsByWeek(weekLabel: string): CostItem[] {
  return getAllCostItems().filter((c) => c.weekLabel === weekLabel);
}

export function saveCostItems(items: CostItem[]): void {
  writeRows(FILE, SHEET, items);
}

export function createCostItem(data: {
  weekLabel: string;
  categoryId: string;
  amount: number;
  note?: string | null;
}): CostItem {
  const items = getAllCostItems();
  const item: CostItem = {
    id: crypto.randomUUID(),
    weekLabel: data.weekLabel,
    categoryId: data.categoryId,
    amount: data.amount,
    note: data.note ?? null,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  saveCostItems(items);
  return item;
}

export function updateCostItem(
  id: string,
  data: Partial<Pick<CostItem, "amount" | "note" | "categoryId">>
): void {
  saveCostItems(getAllCostItems().map((c) => (c.id === id ? { ...c, ...data } : c)));
}

export function deleteCostItem(id: string): void {
  saveCostItems(getAllCostItems().filter((c) => c.id !== id));
}
