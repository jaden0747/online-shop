import { readRows, writeRows, toStr, toNum } from "./excel";
import type { KitchenNote } from "./types";

const FILE = "notes.xlsx";
const SHEET = "Notes";

function parse(raw: Record<string, unknown>): KitchenNote {
  return {
    id: toStr(raw.id),
    weekLabel: toStr(raw.weekLabel),
    customerId: toStr(raw.customerId),
    day: toNum(raw.day),
    note: toStr(raw.note),
  };
}

export function getAllNotes(): KitchenNote[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((n) => n.id && n.weekLabel && n.customerId && n.day);
}

export function getNotesByWeek(weekLabel: string): KitchenNote[] {
  return getAllNotes().filter((n) => n.weekLabel === weekLabel);
}

export function saveNotes(notes: KitchenNote[]): void {
  writeRows(FILE, SHEET, notes);
}

export function upsertNote(data: { weekLabel: string; customerId: string; day: number; note: string }): void {
  const all = getAllNotes();
  const id = `${data.weekLabel}-${data.customerId}-${data.day}`;
  const idx = all.findIndex((n) => n.id === id);
  if (data.note.trim() === "") {
    if (idx >= 0) saveNotes(all.filter((_, i) => i !== idx));
    return;
  }
  const record: KitchenNote = { id, ...data };
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  saveNotes(all);
}
