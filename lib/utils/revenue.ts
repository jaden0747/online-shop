import type { Subscription, MealSkip, SubscriptionExtra, Payment, CreditTransaction } from "@/lib/data/types";
import { countWorkingDays } from "./subscription";

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
>;

/**
 * Cost per delivered day for a subscription.
 *
 * Uses the actual working days from startDate to endDateNoSkip (the period the customer
 * paid for, excluding skip extensions) so prorated first periods yield the correct
 * per-day rate. Falls back to 1 to avoid division by zero on degenerate subs.
 */
export function pricePerDay(sub: SubForRevenue): number {
  const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
  const start = normalizeDate(sub.startDate);
  const endNoSkip = new Date(normalizeDate(sub.endDateNoSkip));
  endNoSkip.setDate(endNoSkip.getDate() + 1); // make inclusive
  const days = Math.max(1, countWorkingDays(start, endNoSkip));
  return effectiveTotal / days;
}

/**
 * Working days actually delivered from startDate through `asOf` (inclusive),
 * accounting for skips.
 *
 * Formula:
 *   workingDays([startDate, cutoff])
 *   − skips where originalDay ∈ [startDate, cutoff]  (those days were not served)
 *
 * Replacement days are already working days counted by countWorkingDays if they fall
 * within [startDate, cutoff], so no explicit addition is needed for them.
 * The original skip day being subtracted correctly nets to: original skipped − replacement served = 0
 * when both are in the range. When replacement is outside the range, only the subtraction applies.
 */
export function daysDeliveredAsOf(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  asOf: Date
): number {
  const start = normalizeDate(sub.startDate);
  const cutoffRaw = sub.status === "cancelled" && sub.cancelledAt
    ? normalizeDate(sub.cancelledAt)
    : normalizeDate(sub.endDate);
  const cutoff = new Date(Math.min(asOf.getTime(), cutoffRaw.getTime()));

  if (cutoff < start) return 0;

  // Working days in [start, cutoff] inclusive
  const cutoffExcl = new Date(cutoff);
  cutoffExcl.setDate(cutoffExcl.getDate() + 1);
  const scheduled = countWorkingDays(start, cutoffExcl);

  // Skips whose original day was in the scheduled window (those days were not served)
  const subSkips = skips.filter((sk) => sk.subscriptionId === sub.id);
  const skipped = subSkips.filter((sk) => {
    const d = normalizeDate(sk.originalDay);
    return d >= start && d <= cutoff;
  }).length;

  return Math.max(0, scheduled - skipped);
}

/**
 * Recognized (earned) revenue for a subscription as of `asOf`.
 *
 * = pricePerDay × daysDeliveredAsOf + extras whose recognition date ≤ asOf.
 * Extra recognition date: forDate if set, otherwise createdAt.
 */
export function earnedRevenueAsOf(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  extras: Pick<SubscriptionExtra, "subscriptionId" | "amount" | "forDate" | "createdAt">[],
  asOf: Date
): number {
  const ppd = pricePerDay(sub);
  const days = daysDeliveredAsOf(sub, skips, asOf);
  const subExtras = extras.filter((e) => e.subscriptionId === sub.id);
  const extrasRecognized = subExtras
    .filter((e) => {
      const d = normalizeDate(e.forDate ?? e.createdAt);
      return d <= asOf;
    })
    .reduce((s, e) => s + e.amount, 0);
  return Math.round(ppd * days) + extrasRecognized;
}

/**
 * Recognized revenue for a subscription earned strictly within [from, to] (inclusive).
 *
 * Used for weekly bucketing in the reports chart.
 */
export function earnedRevenueInRange(
  sub: SubForRevenue,
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  extras: Pick<SubscriptionExtra, "subscriptionId" | "amount" | "forDate" | "createdAt">[],
  from: Date,
  to: Date
): number {
  const start = normalizeDate(sub.startDate);
  const cutoffRaw = sub.status === "cancelled" && sub.cancelledAt
    ? normalizeDate(sub.cancelledAt)
    : normalizeDate(sub.endDate);

  // Intersect [from, to] with [startDate, cutoff]
  const rangeStart = new Date(Math.max(from.getTime(), start.getTime()));
  const rangeEnd = new Date(Math.min(to.getTime(), cutoffRaw.getTime()));

  if (rangeStart > rangeEnd) return 0;

  const ppd = pricePerDay(sub);
  const subSkips = skips.filter((sk) => sk.subscriptionId === sub.id);

  // Working days in [rangeStart, rangeEnd] inclusive
  const rangeEndExcl = new Date(rangeEnd);
  rangeEndExcl.setDate(rangeEndExcl.getDate() + 1);
  const scheduled = countWorkingDays(rangeStart, rangeEndExcl);

  // Skips whose original day falls in the range
  const skipped = subSkips.filter((sk) => {
    const d = normalizeDate(sk.originalDay);
    return d >= rangeStart && d <= rangeEnd;
  }).length;

  const deliveredInRange = Math.max(0, scheduled - skipped);

  // Extras attributed to this range
  const subExtras = extras.filter((e) => e.subscriptionId === sub.id);
  const extrasInRange = subExtras
    .filter((e) => {
      const d = normalizeDate(e.forDate ?? e.createdAt);
      return d >= from && d <= to;
    })
    .reduce((s, e) => s + e.amount, 0);

  return Math.round(ppd * deliveredInRange) + extrasInRange;
}

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
  extras: Pick<SubscriptionExtra, "subscriptionId" | "amount" | "forDate" | "createdAt">[],
  asOf: Date
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
  const earned = earnedRevenueAsOf(sub, skips, extras, asOf);
  return Math.max(0, collected - cashRefunded - refundedToCredit - earned);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function normalizeDate(d: Date | string): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}
