import { totalScheduledMeals, servedMealsInRange } from "./schedule";

export function planTotalMeals(plan: string): number {
  if (plan === "monthly") return 20;
  if (plan === "weekly") return 5;
  return 3; // trial
}

/** Count Mon–Fri days from `from` (inclusive) to `to` (exclusive). */
export function countWorkingDays(from: Date, to: Date): number {
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

export function daysRemaining(endDate: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 86400000));
}

export function workingDaysRemaining(endDate: Date | string): number {
  return countWorkingDays(new Date(), new Date(endDate));
}

/**
 * Meals remaining from today (inclusive) through endDate (inclusive),
 * based on the subscription's weekly schedule.
 *
 * Backward compat: when weeklyScheduleJson is absent, falls back to
 * workingDays × mealsPerDay (same as before).
 */
export function mealsRemaining(
  sub: { mealsPerDay: number; weeklyScheduleJson?: string | null },
  endDate: Date | string
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (end < today) return 0;
  return totalScheduledMeals(sub, today, end);
}

/** A subscription is live when `asOf` (defaults to today) falls within [startDate, endDate] and it is not cancelled. */
export function isSubscriptionLive(status: string, startDate: Date | string, endDate: Date | string, asOf?: Date): boolean {
  if (status === "cancelled") return false;
  const ref = asOf ? new Date(asOf) : new Date();
  ref.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return ref >= start && ref <= end;
}

/** Returns a derived display status based on dates, overriding with manual cancel. */
export function subscriptionStatus(status: string, startDate: Date | string, endDate: Date | string): string {
  if (status === "cancelled") return "cancelled";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (today < start) return "upcoming";
  if (today > end) return "expired";
  return "active";
}

/**
 * Prorated amount for the first partial period.
 * Weekly: counts working days remaining in the current Mon–Fri week from startDate.
 * Monthly: counts working days remaining in the current month from startDate.
 * Trial: full amount (no proration).
 */
export function proratedAmount(
  plan: string,
  mealsPerDay: number,
  pricePerMeal: number,
  startDate: Date
): number {
  if (plan === "trial") {
    return planTotalMeals("trial") * mealsPerDay * pricePerMeal;
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (plan === "weekly") {
    // Next Monday after startDate
    const dow = start.getDay(); // 0=Sun
    const daysToNextMon = dow === 0 ? 1 : 8 - dow;
    const nextMon = new Date(start);
    nextMon.setDate(start.getDate() + daysToNextMon);
    const days = countWorkingDays(start, nextMon);
    return days * mealsPerDay * pricePerMeal;
  }

  if (plan === "monthly") {
    const startOfNextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const days = countWorkingDays(start, startOfNextMonth);
    return days * mealsPerDay * pricePerMeal;
  }

  return planTotalMeals(plan) * mealsPerDay * pricePerMeal;
}

export function isFullPeriod(plan: string, startDate: Date): boolean {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  if (plan === "weekly") {
    return start.getDay() === 1; // starts on Monday
  }
  if (plan === "monthly") {
    return start.getDate() === 1; // starts on 1st of month
  }
  return true;
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Returns "YYYY-MM-DD" using local calendar date (safe in any timezone). */
export function localDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function todayDateStr(): string {
  return localDateStr(new Date());
}

/** Returns true if a given Date falls on today (ignoring time). */
export function isToday(d: Date | string): boolean {
  const t = new Date(d);
  const n = new Date();
  return (
    t.getFullYear() === n.getFullYear() &&
    t.getMonth() === n.getMonth() &&
    t.getDate() === n.getDate()
  );
}

export function isTodayWeekday(): boolean {
  const d = new Date().getDay();
  return d >= 1 && d <= 5;
}

/** Returns the date after `n` working days (Mon–Fri) from `from`. Negative `n` moves backward. */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  if (n === 0) return d;
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (d.getDay() >= 1 && d.getDay() <= 5) remaining--;
  }
  return d;
}

/**
 * Count working-day steps from `from` to `to`.
 * Equivalent to the `n` you'd pass to `addWorkingDays(from, n)` to reach `to`.
 */
export function workingDaysBetween(from: Date, to: Date): number {
  const f = new Date(from); f.setHours(0, 0, 0, 0); f.setDate(f.getDate() + 1);
  const t = new Date(to); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 1);
  return Math.max(0, countWorkingDays(f, t));
}

/** Returns the next Mon–Fri day strictly after `from`. */
export function nextWorkingDay(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * For a trial subscription starting on `startDate`, returns the array of
 * day-of-week numbers (1=Mon…5=Fri) that the trial covers (3 working days).
 */
export function trialDays(startDate: Date): number[] {
  const days: number[] = [];
  let cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  while (days.length < 3) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) days.push(dow);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Working days remaining from today (inclusive) through endDate (inclusive).
 * Used for refund calculation.
 */
export function workingDaysRemainingInclusive(endDate: Date | string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1); // make endDate inclusive in countWorkingDays
  return Math.max(0, countWorkingDays(today, end));
}

export interface SuggestedRefundResult {
  /** Backward-compatible day-based fields. */
  pricePerDay?: number;
  totalDays?: number;
  remainingDays?: number;
  refundDays?: number;
  futureSkipsNoReplace?: number;
  pastSkipsNoReplace?: number;
  /** Price per single meal (effectiveTotal / totalScheduledMeals). */
  pricePerMeal: number;
  /** Total meals across the subscription period [startDate, endDate]. */
  totalMeals: number;
  /** Meals already delivered before the cancellation date. */
  mealsDelivered: number;
  /** Meals not yet delivered = totalMeals − mealsDelivered. */
  remainingMeals: number;
  /** pricePerMeal × remainingMeals */
  proRataRefund: number;
  /** Refund portion from period-based extras. */
  extrasRefund: number;
  /** Net amount paid (payments − cash refunds). */
  netPaid: number;
  /** min(proRataRefund + extrasRefund, netPaid), ≥ 0 */
  suggested: number;
  isCapped: boolean;
}

/**
 * Compute the suggested refund when cancelling a subscription.
 *
 * Formula:
 *   pricePerMeal    = effectiveTotal / totalScheduledMeals(startDate, endDateNoSkip)
 *   mealsDelivered  = servedMealsInRange(startDate, cancelDate − 1)
 *   remainingMeals  = totalScheduledMeals(startDate, endDate) − mealsDelivered
 *   proRata         = round(pricePerMeal × remainingMeals)
 *   suggested       = max(0, min(proRata + extrasRefund, netPaid))
 *
 * Backward compat: when weeklyScheduleJson is absent,
 *   totalScheduledMeals = workingDays × mealsPerDay → same result as old day-based calc.
 */
export function suggestedRefund(
  sub: {
    plan: string;
    startDate?: string;
    subscriptionPrice: number;
    shippingPrice: number;
    discount: number;
    endDate: string;
    endDateNoSkip?: string | null;
    mealsPerDay?: number;
    weeklyScheduleJson?: string | null;
  },
  skips: { originalDay: string; replacementDay: string | null }[],
  payments: { type: "payment" | "refund"; amount: number }[],
  asOf?: Date,
  extras: { amount: number; startDate: string | null; endDate: string | null }[] = []
): SuggestedRefundResult {
  const today = asOf ? new Date(asOf) : new Date();
  today.setHours(0, 0, 0, 0);

  if (!sub.startDate || !sub.mealsPerDay) {
    const totalDays = Math.max(1, planTotalMeals(sub.plan));
    const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
    const pricePerDayVal = effectiveTotal / totalDays;
    const endForRefund = new Date(sub.endDate);
    endForRefund.setDate(endForRefund.getDate() + 1);
    const remainingDays = Math.max(0, countWorkingDays(today, endForRefund));
    const futureSkipsNoReplace = skips.filter((sk) => {
      const d = new Date(sk.originalDay);
      d.setHours(0, 0, 0, 0);
      return d >= today && !sk.replacementDay;
    }).length;
    const pastSkipsNoReplace = skips.filter((sk) => {
      const d = new Date(sk.originalDay);
      d.setHours(0, 0, 0, 0);
      return d < today && !sk.replacementDay;
    }).length;
    const refundDays = Math.max(0, remainingDays - futureSkipsNoReplace + pastSkipsNoReplace);
    const proRataRefund = Math.round(pricePerDayVal * refundDays);

    const extrasRefund = extras.reduce((s, e) => {
      if (!e.startDate || !e.endDate) return s;
      const start = new Date(e.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(e.endDate); end.setHours(0, 0, 0, 0);
      const refundStart = new Date(Math.max(today.getTime(), start.getTime()));
      const endExcl = new Date(end.getTime() + 86_400_000);
      const totalExtraDays = Math.max(1, countWorkingDays(start, endExcl));
      const pastSkipsInPeriod = skips.filter((sk) => {
        const d = new Date(sk.originalDay); d.setHours(0, 0, 0, 0);
        if (d < start || d >= refundStart) return false;
        if (!sk.replacementDay) return true;
        const rep = new Date(sk.replacementDay); rep.setHours(0, 0, 0, 0);
        return rep < start || rep > end;
      }).length;
      const remaining = refundStart > end ? 0 : countWorkingDays(refundStart, endExcl);
      const adjustedRemaining = Math.min(totalExtraDays, remaining + pastSkipsInPeriod);
      if (adjustedRemaining === 0) return s;
      return s + Math.round((e.amount * adjustedRemaining) / totalExtraDays);
    }, 0);

    const netPaid = payments.reduce(
      (s, p) => s + (p.type === "payment" ? p.amount : -p.amount),
      0
    );
    const suggested = Math.max(0, Math.min(proRataRefund + extrasRefund, netPaid));
    const isCapped = proRataRefund + extrasRefund > netPaid && netPaid > 0;
    return {
      pricePerDay: Math.round(pricePerDayVal),
      totalDays,
      remainingDays,
      refundDays,
      futureSkipsNoReplace,
      pastSkipsNoReplace,
      pricePerMeal: Math.round(pricePerDayVal),
      totalMeals: totalDays,
      mealsDelivered: Math.max(0, totalDays - refundDays),
      remainingMeals: refundDays,
      proRataRefund,
      extrasRefund,
      netPaid,
      suggested,
      isCapped,
    };
  }

  const startDate = new Date(sub.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(sub.endDate);
  endDate.setHours(0, 0, 0, 0);
  const endDateNoSkip = sub.endDateNoSkip ? new Date(sub.endDateNoSkip) : endDate;
  endDateNoSkip.setHours(0, 0, 0, 0);

  const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
  const mealSub = {
    ...sub,
    startDate: sub.startDate,
    mealsPerDay: sub.mealsPerDay,
  };

  // Price per meal is based on the original period (endDateNoSkip), not extensions.
  const planMeals = Math.max(1, totalScheduledMeals(mealSub, startDate, endDateNoSkip));
  const pricePerMealVal = effectiveTotal / planMeals;

  // Total meals including any skip-extension days.
  const totalMeals = totalScheduledMeals(mealSub, startDate, endDate);

  // Meals already delivered — up to but NOT including `today` (cancellation date).
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const mealsDelivered =
    yesterday < startDate
      ? 0
      : servedMealsInRange(mealSub, skips, startDate, yesterday);

  const remainingMeals = Math.max(0, totalMeals - mealsDelivered);
  const proRataRefund = Math.round(pricePerMealVal * remainingMeals);

  // Extras: refund the remaining portion of each period extra (day-based, unchanged).
  const extrasRefund = extras.reduce((s, e) => {
    if (!e.startDate || !e.endDate) return s;
    const start = new Date(e.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(e.endDate); end.setHours(0, 0, 0, 0);
    const refundStart = new Date(Math.max(today.getTime(), start.getTime()));
    const endExcl = new Date(end.getTime() + 86_400_000);
    const totalDays = Math.max(1, countWorkingDays(start, endExcl));
    const pastSkipsInPeriod = skips.filter((sk) => {
      const d = new Date(sk.originalDay); d.setHours(0, 0, 0, 0);
      if (d < start || d >= refundStart) return false;
      if (!sk.replacementDay) return true;
      const rep = new Date(sk.replacementDay); rep.setHours(0, 0, 0, 0);
      return rep < start || rep > end;
    }).length;
    const remaining = refundStart > end ? 0 : countWorkingDays(refundStart, endExcl);
    const adjustedRemaining = Math.min(totalDays, remaining + pastSkipsInPeriod);
    if (adjustedRemaining === 0) return s;
    return s + Math.round((e.amount * adjustedRemaining) / totalDays);
  }, 0);

  const netPaid = payments.reduce(
    (s, p) => s + (p.type === "payment" ? p.amount : -p.amount),
    0
  );

  const suggested = Math.max(0, Math.min(proRataRefund + extrasRefund, netPaid));
  const isCapped = proRataRefund + extrasRefund > netPaid && netPaid > 0;

  return {
    pricePerDay: Math.round(pricePerMealVal * Math.max(1, sub.mealsPerDay)),
    totalDays: totalMeals / Math.max(1, sub.mealsPerDay),
    remainingDays: remainingMeals / Math.max(1, sub.mealsPerDay),
    refundDays: remainingMeals / Math.max(1, sub.mealsPerDay),
    futureSkipsNoReplace: 0,
    pastSkipsNoReplace: 0,
    pricePerMeal: Math.round(pricePerMealVal),
    totalMeals,
    mealsDelivered,
    remainingMeals,
    proRataRefund,
    extrasRefund,
    netPaid,
    suggested,
    isCapped,
  };
}

/**
 * Calculate the prorated total due for a cancelled subscription.
 * For cancelled subs, totalDue reflects only meals delivered.
 * Extras with date ranges are pro-rated to only charge for the delivered portion.
 */
export function calculateProratedTotalDue(
  sub: {
    plan: string;
    startDate: string;
    subscriptionPrice: number;
    shippingPrice: number;
    discount: number;
    endDate: string;
    endDateNoSkip?: string | null;
    cancelledAt?: string | null;
    mealsPerDay: number;
    weeklyScheduleJson?: string | null;
  },
  skips: { originalDay: string; replacementDay: string | null }[],
  extras: { amount: number; startDate: string | null; endDate: string | null }[]
): number {
  const startDate = new Date(sub.startDate);
  startDate.setHours(0, 0, 0, 0);
  const endDateNoSkip = sub.endDateNoSkip ? new Date(sub.endDateNoSkip) : new Date(sub.endDate);
  endDateNoSkip.setHours(0, 0, 0, 0);

  const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
  const planMeals = Math.max(1, totalScheduledMeals(sub, startDate, endDateNoSkip));
  const pricePerMealVal = effectiveTotal / planMeals;

  const cutoff = sub.cancelledAt ? new Date(sub.cancelledAt) : new Date();
  cutoff.setHours(0, 0, 0, 0);

  // Meals delivered up to but NOT including cancelledAt
  const yesterday = new Date(cutoff);
  yesterday.setDate(yesterday.getDate() - 1);
  const mealsDelivered =
    yesterday < startDate
      ? 0
      : servedMealsInRange(sub, skips, startDate, yesterday);

  const baseCharge = Math.round(pricePerMealVal * mealsDelivered);

  const extrasCharged = extras.reduce((sum, e) => {
    if (!e.startDate || !e.endDate) return sum + e.amount;

    const start = new Date(e.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(e.endDate); end.setHours(0, 0, 0, 0);
    const refundStart = new Date(Math.max(cutoff.getTime(), start.getTime()));
    const endExcl = new Date(end.getTime() + 86_400_000);
    const extraTotalDays = Math.max(1, countWorkingDays(start, endExcl));

    const pastSkipsInPeriod = skips.filter((sk) => {
      const d = new Date(sk.originalDay); d.setHours(0, 0, 0, 0);
      if (d < start || d >= refundStart) return false;
      if (!sk.replacementDay) return true;
      const rep = new Date(sk.replacementDay); rep.setHours(0, 0, 0, 0);
      return rep < start || rep > end;
    }).length;

    const remaining = refundStart > end ? 0 : countWorkingDays(refundStart, endExcl);
    const adjustedRemaining = Math.min(extraTotalDays, remaining + pastSkipsInPeriod);
    const usedDays = extraTotalDays - adjustedRemaining;
    if (usedDays <= 0) return sum;
    return sum + Math.round((e.amount * usedDays) / extraTotalDays);
  }, 0);

  return baseCharge + extrasCharged;
}
