import { readRows, writeRows, toStr, toStrOrNull, toNum } from "./excel";
import type { MenuItem } from "./types";

const FILE = "menu.xlsx";
const SHEET = "Menu";

function parseItem(raw: Record<string, unknown>): MenuItem {
  const weekLabel = toStr(raw.weekLabel);
  const day = toNum(raw.day);
  const slot = toNum(raw.slot);
  return {
    id: `${weekLabel}-${day}-${slot}`,
    weekLabel,
    day,
    slot,
    name: toStr(raw.name),
    description: toStrOrNull(raw.description),
    calories: raw.calories !== null && raw.calories !== undefined ? toNum(raw.calories) : null,
    protein: raw.protein !== null && raw.protein !== undefined ? toNum(raw.protein) : null,
    goals: toStr(raw.goals),
  };
}

export function getAllMenuItems(): MenuItem[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parseItem)
    .filter((m) => m.weekLabel && m.day && m.name);
}

export function getMenuItemsByWeek(weekLabel: string): MenuItem[] {
  return getAllMenuItems().filter((m) => m.weekLabel === weekLabel);
}

export function saveMenuItems(items: MenuItem[]): void {
  // Store without the computed `id` field
  writeRows(
    FILE,
    SHEET,
    items.map(({ id: _id, ...rest }) => rest)
  );
}

export function upsertMenuItem(data: {
  weekLabel: string;
  day: number;
  slot: number;
  name: string;
  description?: string | null;
  calories?: number | null;
  protein?: number | null;
  goals: string;
}): void {
  const items = getAllMenuItems();
  const existing = items.findIndex(
    (m) => m.weekLabel === data.weekLabel && m.day === data.day && m.slot === data.slot
  );
  const item: MenuItem = {
    id: `${data.weekLabel}-${data.day}-${data.slot}`,
    ...data,
    description: data.description ?? null,
    calories: data.calories ?? null,
    protein: data.protein ?? null,
  };
  if (existing >= 0) {
    items[existing] = item;
  } else {
    items.push(item);
  }
  saveMenuItems(items);
}

export function deleteMenuItem(id: string): void {
  // id format: weekLabel-day-slot, but weekLabel itself has dashes
  // Find by composite key approach: last two segments are day and slot
  const parts = id.split("-");
  const slot = Number(parts[parts.length - 1]);
  const day = Number(parts[parts.length - 2]);
  const weekLabel = parts.slice(0, parts.length - 2).join("-");
  saveMenuItems(
    getAllMenuItems().filter(
      (m) => !(m.weekLabel === weekLabel && m.day === day && m.slot === slot)
    )
  );
}
