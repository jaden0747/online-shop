import type { Subscription, MealSkip, MealDeliveryPlan, SubscriptionExtra, Payment, CreditTransaction } from "@/lib/data/types";
import { totalMealEntitlement, servedMealsInRange } from "./schedule";

type SubForRevenue = Pick<
  Subscription,
  | "id"
  | "subscriptionPrice"
  | "shippingPrice"
  | "discount"
  | "startDate"
  | "endDate"
  | "endDateNoSkip"
  | "cancelledAt"
  | "status"
  | "mealsPerDay"
  | "totalMeals"
  | "weeklyScheduleJson"
>;

// ── Price per meal ────────────────────────────────────────────────────────────

/**
 * Price per single meal for a subscription.
 *
 * Uses the actual scheduled meals from startDate to endDateNoSkip (the period
 * the customer paid for, excluding skip extensions). Falls back to 1 to avoid
 * division by zero on degenerate subs.
 *
 * Backward compat: for uniform subscriptions (no weeklyScheduleJson),
 *   totalScheduledMeals = workingDays × mealsPerDay
 *   → pricePerMeal = effectiveTotal / (workingDays × mealsPerDay)
 *   → same as old pricePerDay / mealsPerDay
 */
export function pricePerMeal(sub: SubForRevenue): number {
  const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
  const start = normalizeDate(sub.startDate);
  const endNoSkip = normalizeDate(sub.endDateNoSkip);
  const total = Math.max(1, totalMealEntitlement({ ...sub, startDate: start.toISOString(), endDateNoSkip: endNoSkip.toISOString() }));
  return effectiveTotal / total;
}

/** Backward-compatible day price for older callers/tests. */
export function pricePerDay(sub: SubForRevenue): number {
  return pricePerMeal(sub) * Math.max(1, sub.mealsPerDay);
}

// ── Meals delivered ───────────────────────────────────────────────────────────

/**
 * Meals actually served from startDate through `asOf` (inclusive),
 * accounting for skips.
 *
 * A skipped day contributes 0 meals; replacement days are ordinary weekdays
 * and are counted at their own scheduled meal count.
 */
export function mealsDeliveredAsOf(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  asOf: Date,
  mealPlans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = []
): number {
  const start = normalizeDate(sub.startDate);
  // cancelledAt is the FIRST UNSERVED day (exclusive upper bound).
  // For non-cancelled subs endDate is the last served day (inclusive).
  const cutoffRaw =
    sub.status === "cancelled" && sub.cancelledAt
      ? (() => {
          const d = normalizeDate(sub.cancelledAt);
          d.setDate(d.getDate() - 1);
          return d;
        })()
      : normalizeDate(sub.endDate);
  const cutoff = new Date(Math.min(asOf.getTime(), cutoffRaw.getTime()));

  if (cutoff < start) return 0;

  const subSkips = skips.filter((sk) => sk.subscriptionId === sub.id);
  const plans = mealPlans.filter((p) => p.subscriptionId === sub.id);
  return servedMealsInRange(sub, subSkips, start, cutoff, plans);
}

/** Backward-compatible delivered-day count for older callers/tests. */
export function daysDeliveredAsOf(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  asOf: Date,
  mealPlans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = []
): number {
  return mealsDeliveredAsOf(sub, skips, asOf, mealPlans) / Math.max(1, sub.mealsPerDay);
}

// ── Earned revenue ────────────────────────────────────────────────────────────

/**
 * Recognized (earned) revenue for a subscription as of `asOf`.
 *
 * = pricePerMeal × mealsDeliveredAsOf + extras whose recognition date ≤ asOf.
 */
export function earnedRevenueAsOf(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  extras: Pick<SubscriptionExtra, "subscriptionId" | "amount" | "startDate" | "endDate" | "createdAt">[],
  asOf: Date,
  mealPlans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = []
): number {
  const ppm = pricePerMeal(sub);
  const meals = mealsDeliveredAsOf(sub, skips, asOf, mealPlans);
  const subExtras = extras.filter((e) => e.subscriptionId === sub.id);
  const extrasRecognized = subExtras.reduce((s, e) => s + extraEarnedAsOf(e, asOf), 0);
  return Math.round(ppm * meals) + extrasRecognized;
}

/**
 * Recognized revenue for a subscription earned strictly within [from, to] (inclusive).
 *
 * Used for weekly bucketing in the reports chart.
 */
export function earnedRevenueInRange(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  extras: Pick<SubscriptionExtra, "subscriptionId" | "amount" | "startDate" | "endDate" | "createdAt">[],
  from: Date,
  to: Date,
  mealPlans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = []
): number {
  const start = normalizeDate(sub.startDate);
  // cancelledAt is the FIRST UNSERVED day (exclusive). Last served = cancelledAt - 1.
  const cutoffRaw =
    sub.status === "cancelled" && sub.cancelledAt
      ? (() => {
          const d = normalizeDate(sub.cancelledAt);
          d.setDate(d.getDate() - 1);
          return d;
        })()
      : normalizeDate(sub.endDate);

  // Intersect [from, to] with [startDate, cutoff]
  const rangeStart = new Date(Math.max(from.getTime(), start.getTime()));
  const rangeEnd = new Date(Math.min(to.getTime(), cutoffRaw.getTime()));

  if (rangeStart > rangeEnd) return 0;

  const ppm = pricePerMeal(sub);
  const subSkips = skips.filter((sk) => sk.subscriptionId === sub.id);
  const plans = mealPlans.filter((p) => p.subscriptionId === sub.id);
  const deliveredInRange = servedMealsInRange(sub, subSkips, rangeStart, rangeEnd, plans);

  // Extras: recognize the portion of each extra that falls within [from, to]
  const subExtras = extras.filter((e) => e.subscriptionId === sub.id);
  const extrasInRange = subExtras.reduce((s, e) => {
    const earned = extraEarnedAsOf(e, to) - extraEarnedAsOf(e, new Date(from.getTime() - 86_400_000));
    return s + earned;
  }, 0);

  return Math.round(ppm * deliveredInRange) + extrasInRange;
}

// ── Deferred revenue ──────────────────────────────────────────────────────────

/**
 * Deferred revenue for a subscription as of `asOf`.
 *
 * = max(0, paymentsCollected − cashRefunded − refundedToCredit − earnedRevenue)
 *
 * Represents how much of the collected cash has not yet been earned by delivery.
 * Goes to zero once the sub is fully delivered or fully compensated.
 */
export function deferredRevenue(
  sub: SubForRevenue,
  payments: Pick<Payment, "subscriptionId" | "type" | "amount">[],
  credits: Pick<CreditTransaction, "subscriptionId" | "type" | "amount">[],
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  extras: Pick<SubscriptionExtra, "subscriptionId" | "amount" | "startDate" | "endDate" | "createdAt">[],
  asOf: Date,
  mealPlans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = []
): number {
  const subPayments = payments.filter((p) => p.subscriptionId === sub.id);
  const collected = subPayments
    .filter((p) => p.type === "payment")
    .reduce((s, p) => s + p.amount, 0);
  const cashRefunded = subPayments
    .filter((p) => p.type === "refund")
    .reduce((s, p) => s + p.amount, 0);
  const refundedToCredit = credits
    .filter((t) => t.subscriptionId === sub.id && t.type === "refund_credit")
    .reduce((s, t) => s + t.amount, 0);
  const earned = earnedRevenueAsOf(sub, skips, extras, asOf, mealPlans);
  return Math.max(0, collected - cashRefunded - refundedToCredit - earned);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Recognized revenue from a single extra as of `asOf`, pro-rated by working days.
 * If the extra has no startDate, it's recognized in full on createdAt.
 */
function extraEarnedAsOf(
  e: Pick<SubscriptionExtra, "amount" | "startDate" | "endDate" | "createdAt">,
  asOf: Date
): number {
  if (!e.startDate) {
    // Legacy single-date or undated: recognize in full on createdAt
    return normalizeDate(e.createdAt) <= asOf ? e.amount : 0;
  }
  const start = normalizeDate(e.startDate);
  const end = e.endDate ? normalizeDate(e.endDate) : start;
  if (start > asOf) return 0;
  const effectiveEnd = new Date(Math.min(end.getTime(), asOf.getTime()));
  // Extras remain day-based (they are independent flat charges, not tied to meal counts).
  const totalDays = Math.max(1, countWorkingDays(start, nextDay(end)));
  const earnedDays = countWorkingDays(start, nextDay(effectiveEnd));
  return Math.round((e.amount * earnedDays) / totalDays);
}

/** Count Mon–Fri days in [from, to) */
function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const day = cur.getDay();
    if (day >= 1 && day <= 5) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function nextDay(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + 1);
  return r;
}

function normalizeDate(d: Date | string): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}
