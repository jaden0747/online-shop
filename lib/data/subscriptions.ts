import { readRows, writeRows, toStr, toStrOrNull, toNum, toStrOrNull as toNullStr, parseExcelDate } from "./excel";
import type { Subscription, MealSkip, SubscriptionExtra, MealDeliveryPlan } from "./types";

const FILE = "subscriptions.xlsx";
const SHEET_S = "Subscriptions";
const SHEET_SK = "Skips";
const SHEET_EX = "Extras";
const SHEET_MP = "MealPlans";

function parseSub(raw: Record<string, unknown>): Subscription {
  // Backward compat: old rows have packagePrice but not subscriptionPrice
  const subscriptionPrice = raw.subscriptionPrice !== undefined && raw.subscriptionPrice !== null && raw.subscriptionPrice !== ""
    ? toNum(raw.subscriptionPrice)
    : toNum(raw.packagePrice);

  // weeklyScheduleJson: store as JSON string; null/missing = uniform mealsPerDay
  const weeklyScheduleJson: string | null = (() => {
    const raw_ = raw.weeklyScheduleJson;
    if (!raw_ || raw_ === "") return null;
    try { JSON.parse(raw_ as string); return raw_ as string; } catch { return null; }
  })();

  return {
    id: toStr(raw.id),
    customerId: toStr(raw.customerId),
    plan: toStr(raw.plan),
    goal: toStr(raw.goal),
    mealsPerDay: toNum(raw.mealsPerDay) || 1,
    totalMeals: raw.totalMeals !== undefined && raw.totalMeals !== null && raw.totalMeals !== "" ? toNum(raw.totalMeals) : null,
    weeklyScheduleJson,
    status: toStr(raw.status) || "active",
    shippingPrice: toNum(raw.shippingPrice),
    subscriptionPrice,
    discount: toNum(raw.discount) || 0,
    trialDays: raw.trialDays !== undefined && raw.trialDays !== null && raw.trialDays !== "" ? toNum(raw.trialDays) : null,
     startDate: parseExcelDate(raw.startDate as string | number) ?? new Date().toISOString(),
     endDate: parseExcelDate(raw.endDate as string | number) ?? parseExcelDate(raw.renewalDate as string | number) ?? new Date().toISOString(),
     endDateNoSkip: parseExcelDate(raw.endDateNoSkip as string | number) ?? parseExcelDate(raw.endDate as string | number) ?? parseExcelDate(raw.renewalDate as string | number) ?? new Date().toISOString(),
    cancelReason: toStrOrNull(raw.cancelReason),
    cancelledAt: toStrOrNull(raw.cancelledAt),
    addressId: toStrOrNull(raw.addressId),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

function parseMealPlan(raw: Record<string, unknown>): MealDeliveryPlan {
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    date: parseExcelDate(raw.date as string | number) ?? new Date().toISOString(),
    plannedMeals: Math.max(0, Math.floor(toNum(raw.plannedMeals))),
    reason: toStrOrNull(raw.reason),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

function parseExtra(raw: Record<string, unknown>): SubscriptionExtra {
  const createdAt = toStr(raw.createdAt) || new Date().toISOString();
  // Backward compat: old rows stored a single `forDate`; map it to startDate/endDate (single day).
  const legacy = toStrOrNull(raw.forDate);
  const startDate = toStrOrNull(raw.startDate) ?? legacy;
  const endDate = toStrOrNull(raw.endDate) ?? startDate;
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    amount: toNum(raw.amount),
    note: toNullStr(raw.note),
    startDate,
    endDate,
    createdAt,
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

export function getAllExtras(): SubscriptionExtra[] {
  return readRows<Record<string, unknown>>(FILE, SHEET_EX)
    .map(parseExtra)
    .filter((e) => e.id && e.subscriptionId);
}

export function getAllMealDeliveryPlans(): MealDeliveryPlan[] {
  return readRows<Record<string, unknown>>(FILE, SHEET_MP)
    .map(parseMealPlan)
    .filter((p) => p.id && p.subscriptionId);
}

export function getMealDeliveryPlansBySubscription(subscriptionId: string): MealDeliveryPlan[] {
  return getAllMealDeliveryPlans().filter((p) => p.subscriptionId === subscriptionId);
}

export function getExtrasBySubscription(subscriptionId: string): SubscriptionExtra[] {
  return getAllExtras().filter((e) => e.subscriptionId === subscriptionId);
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

export function saveExtras(extras: SubscriptionExtra[]): void {
  writeRows(FILE, SHEET_EX, extras);
}

export function saveMealDeliveryPlans(plans: MealDeliveryPlan[]): void {
  writeRows(FILE, SHEET_MP, plans);
}

export function createExtra(data: { subscriptionId: string; amount: number; note?: string | null; startDate?: string | null; endDate?: string | null }): SubscriptionExtra {
  const extras = getAllExtras();
  const extra: SubscriptionExtra = {
    id: crypto.randomUUID(),
    subscriptionId: data.subscriptionId,
    amount: data.amount,
    note: data.note ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? data.startDate ?? null,
    createdAt: new Date().toISOString(),
  };
  extras.push(extra);
  saveExtras(extras);
  return extra;
}

export function updateExtra(id: string, data: Partial<Pick<SubscriptionExtra, "amount" | "note" | "startDate" | "endDate">>): void {
  const extras = getAllExtras().map((e) => e.id === id ? { ...e, ...data } : e);
  saveExtras(extras);
}

export function upsertMealDeliveryPlan(data: {
  subscriptionId: string;
  date: string;
  plannedMeals: number;
  reason?: string | null;
}): MealDeliveryPlan {
  const plans = getAllMealDeliveryPlans();
  const targetDate = parseExcelDate(data.date) ?? new Date(data.date).toISOString();
  const targetKey = targetDate.slice(0, 10);
  const existing = plans.find(
    (p) => p.subscriptionId === data.subscriptionId && p.date.slice(0, 10) === targetKey
  );
  const plannedMeals = Math.max(0, Math.floor(data.plannedMeals));
  if (existing) {
    const updated: MealDeliveryPlan = {
      ...existing,
      date: targetDate,
      plannedMeals,
      reason: data.reason ?? existing.reason,
    };
    saveMealDeliveryPlans(plans.map((p) => (p.id === existing.id ? updated : p)));
    return updated;
  }
  const plan: MealDeliveryPlan = {
    id: crypto.randomUUID(),
    subscriptionId: data.subscriptionId,
    date: targetDate,
    plannedMeals,
    reason: data.reason ?? null,
    createdAt: new Date().toISOString(),
  };
  plans.push(plan);
  saveMealDeliveryPlans(plans);
  return plan;
}

export function deleteMealDeliveryPlan(id: string): MealDeliveryPlan | null {
  const plans = getAllMealDeliveryPlans();
  const existing = plans.find((p) => p.id === id) ?? null;
  saveMealDeliveryPlans(plans.filter((p) => p.id !== id));
  return existing;
}

export function deleteMealDeliveryPlanByDate(subscriptionId: string, date: string): MealDeliveryPlan | null {
  const plans = getAllMealDeliveryPlans();
  const key = date.slice(0, 10);
  const existing = plans.find((p) => p.subscriptionId === subscriptionId && p.date.slice(0, 10) === key) ?? null;
  if (existing) saveMealDeliveryPlans(plans.filter((p) => p.id !== existing.id));
  return existing;
}

export function deleteExtra(id: string): void {
  saveExtras(getAllExtras().filter((e) => e.id !== id));
}

export function createSubscription(data: Omit<Subscription, "id" | "createdAt" | "totalMeals"> & { totalMeals?: number | null }): Subscription {
  const subs = getAllSubscriptions();
  const sub: Subscription = {
    ...data,
    totalMeals: data.totalMeals ?? null,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  subs.unshift(sub);
  saveSubscriptions(subs);
  return sub;
}

export function deleteExtrasBySubscription(subscriptionId: string): void {
  saveExtras(getAllExtras().filter((e) => e.subscriptionId !== subscriptionId));
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
