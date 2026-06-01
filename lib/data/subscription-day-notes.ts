import { readRows, writeRows, toStr, toNum } from "./excel";
import type { SubscriptionDayNote } from "./types";

const FILE = "subscription-day-notes.xlsx";
const SHEET = "SubscriptionDayNotes";

function parse(raw: Record<string, unknown>): SubscriptionDayNote {
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    weekLabel: toStr(raw.weekLabel),
    day: toNum(raw.day),
    note: toStr(raw.note),
  };
}

export function getAllSubscriptionDayNotes(): SubscriptionDayNote[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((n) => n.id && n.subscriptionId && n.weekLabel && n.day);
}

export function getSubscriptionDayNotesByWeek(weekLabel: string): SubscriptionDayNote[] {
  return getAllSubscriptionDayNotes().filter((n) => n.weekLabel === weekLabel);
}

export function getSubscriptionDayNotesBySubscription(subscriptionId: string): SubscriptionDayNote[] {
  return getAllSubscriptionDayNotes().filter((n) => n.subscriptionId === subscriptionId);
}

function saveAll(notes: SubscriptionDayNote[]): void {
  writeRows(FILE, SHEET, notes);
}

export function upsertSubscriptionDayNote(data: {
  subscriptionId: string;
  weekLabel: string;
  day: number;
  note: string;
}): void {
  const all = getAllSubscriptionDayNotes();
  const id = `${data.subscriptionId}-${data.weekLabel}-${data.day}`;
  const idx = all.findIndex((n) => n.id === id);
  if (data.note.trim() === "") {
    if (idx >= 0) saveAll(all.filter((_, i) => i !== idx));
    return;
  }
  const record: SubscriptionDayNote = { id, ...data };
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  saveAll(all);
}
