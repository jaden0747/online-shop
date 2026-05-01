import { readRows, writeRows, toStr, toStrOrNull, toNum, parseExcelDate } from "./excel";
import type { Subscription, MealSkip } from "./types";

const FILE = "subscriptions.xlsx";
const SHEET_S = "Subscriptions";
const SHEET_SK = "Skips";

function parseSub(raw: Record<string, unknown>): Subscription {
  return {
    id: toStr(raw.id),
    customerId: toStr(raw.customerId),
    plan: toStr(raw.plan),
    goal: toStr(raw.goal),
    mealsPerDay: toNum(raw.mealsPerDay) || 1,
    status: toStr(raw.status) || "active",
    packagePrice: toNum(raw.packagePrice),
    pricePerMeal: toNum(raw.pricePerMeal),
    startDate: parseExcelDate(raw.startDate as string | number) ?? new Date().toISOString(),
    renewalDate: parseExcelDate(raw.renewalDate as string | number) ?? new Date().toISOString(),
    cancelReason: toStrOrNull(raw.cancelReason),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

function parseSkip(raw: Record<string, unknown>): MealSkip {
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    originalDay: parseExcelDate(raw.originalDay as string | number) ?? new Date().toISOString(),
    replacementDay: parseExcelDate(raw.replacementDay as string | number | null),
    reason: toStrOrNull(raw.reason),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllSubscriptions(): Subscription[] {
  return readRows<Record<string, unknown>>(FILE, SHEET_S)
    .map(parseSub)
    .filter((s) => s.id && s.customerId);
}

export function getAllSkips(): MealSkip[] {
  return readRows<Record<string, unknown>>(FILE, SHEET_SK)
    .map(parseSkip)
    .filter((s) => s.id && s.subscriptionId);
}

export function getSubscriptionById(id: string): Subscription | null {
  return getAllSubscriptions().find((s) => s.id === id) ?? null;
}

export function saveSubscriptions(subs: Subscription[]): void {
  writeRows(FILE, SHEET_S, subs);
}

export function saveSkips(skips: MealSkip[]): void {
  writeRows(FILE, SHEET_SK, skips);
}

export function createSubscription(data: Omit<Subscription, "id" | "createdAt">): Subscription {
  const subs = getAllSubscriptions();
  const sub: Subscription = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  subs.unshift(sub);
  saveSubscriptions(subs);
  return sub;
}

export function updateSubscription(id: string, data: Partial<Subscription>): void {
  const subs = getAllSubscriptions().map((s) =>
    s.id === id ? { ...s, ...data } : s
  );
  saveSubscriptions(subs);
}

export function deleteSubscription(id: string): void {
  saveSubscriptions(getAllSubscriptions().filter((s) => s.id !== id));
  saveSkips(getAllSkips().filter((s) => s.subscriptionId !== id));
}

export function createSkip(data: {
  subscriptionId: string;
  originalDay: string;
  replacementDay?: string | null;
  reason?: string | null;
}): MealSkip {
  const skips = getAllSkips();
  const skip: MealSkip = {
    id: crypto.randomUUID(),
    subscriptionId: data.subscriptionId,
    originalDay: data.originalDay,
    replacementDay: data.replacementDay ?? null,
    reason: data.reason ?? null,
    createdAt: new Date().toISOString(),
  };
  skips.push(skip);
  saveSkips(skips);
  return skip;
}

export function deleteSkip(id: string): MealSkip | null {
  const skips = getAllSkips();
  const skip = skips.find((s) => s.id === id) ?? null;
  saveSkips(skips.filter((s) => s.id !== id));
  return skip;
}
