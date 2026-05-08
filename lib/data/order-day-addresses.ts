import { readRows, writeRows, toStr, toNum } from "./excel";
import type { OrderDayAddress } from "./types";

const FILE = "order-day-addresses.xlsx";
const SHEET = "OrderDayAddresses";

function parse(raw: Record<string, unknown>): OrderDayAddress {
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    weekLabel: toStr(raw.weekLabel),
    day: toNum(raw.day),
    addressId: toStr(raw.addressId),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllOrderDayAddresses(): OrderDayAddress[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((r) => r.id && r.subscriptionId && r.weekLabel && r.day && r.addressId);
}

export function getDayAddress(
  subscriptionId: string,
  weekLabel: string,
  day: number
): OrderDayAddress | null {
  return (
    getAllOrderDayAddresses().find(
      (r) => r.subscriptionId === subscriptionId && r.weekLabel === weekLabel && r.day === day
    ) ?? null
  );
}

function saveAll(rows: OrderDayAddress[]): void {
  writeRows(FILE, SHEET, rows);
}

export function upsertDayAddress(
  subscriptionId: string,
  weekLabel: string,
  day: number,
  addressId: string
): void {
  const all = getAllOrderDayAddresses();
  const id = `${subscriptionId}-${weekLabel}-${day}`;
  const idx = all.findIndex((r) => r.id === id);
  const record: OrderDayAddress = {
    id,
    subscriptionId,
    weekLabel,
    day,
    addressId,
    createdAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }
  saveAll(all);
}

export function deleteDayAddress(
  subscriptionId: string,
  weekLabel: string,
  day: number
): void {
  const id = `${subscriptionId}-${weekLabel}-${day}`;
  saveAll(getAllOrderDayAddresses().filter((r) => r.id !== id));
}
