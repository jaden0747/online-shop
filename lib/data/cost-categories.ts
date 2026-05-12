import { readRows, writeRows, toStr, toNum } from "./excel";
import type { CostCategory } from "./types";

const FILE = "cost-categories.xlsx";
const SHEET = "Categories";

const DEFAULT_CATEGORIES = [
  "Protein",
  "Vegetable",
  "Carbs",
  "Packaging",
  "Seasoning",
  "Labor",
  "Shipping",
  "Other",
];

function parseCategory(raw: Record<string, unknown>): CostCategory {
  return {
    id: toStr(raw.id),
    name: toStr(raw.name),
    sortOrder: toNum(raw.sortOrder) || 0,
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllCostCategories(): CostCategory[] {
  const rows = readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parseCategory)
    .filter((c) => c.id && c.name);
  if (rows.length === 0) {
    // Seed defaults
    const defaults = DEFAULT_CATEGORIES.map((name, i) => ({
      id: crypto.randomUUID(),
      name,
      sortOrder: i,
      createdAt: new Date().toISOString(),
    }));
    writeRows(FILE, SHEET, defaults);
    return defaults;
  }
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function saveCostCategories(categories: CostCategory[]): void {
  writeRows(FILE, SHEET, categories);
}

export function createCostCategory(data: { name: string; sortOrder?: number }): CostCategory {
  const categories = getAllCostCategories();
  const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  const category: CostCategory = {
    id: crypto.randomUUID(),
    name: data.name,
    sortOrder: data.sortOrder ?? maxOrder + 1,
    createdAt: new Date().toISOString(),
  };
  categories.push(category);
  saveCostCategories(categories);
  return category;
}

export function updateCostCategory(id: string, data: Partial<Pick<CostCategory, "name" | "sortOrder">>): void {
  saveCostCategories(getAllCostCategories().map((c) => (c.id === id ? { ...c, ...data } : c)));
}

export function deleteCostCategory(id: string): void {
  saveCostCategories(getAllCostCategories().filter((c) => c.id !== id));
}
