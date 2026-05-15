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

/** Meals left = working days from today to endDate (inclusive) × mealsPerDay. */
export function mealsRemaining(endDate: Date | string, mealsPerDay: number): number {
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1); // add 1 day to make endDate inclusive
  return Math.max(0, countWorkingDays(new Date(), end) * mealsPerDay);
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

export interface RefundDaysResult {
  refundDays: number;
  remainingDays: number;
  futureSkipsNoReplace: number;
  pastSkipsNoReplace: number;
}

/**
 * Calculate refund days for a subscription (days that qualify for refund).
 * Extracted from suggestedRefund for reuse in balance calculations.
 */
export function calculateRefundDays(
  sub: { plan: string; endDate: string; cancelledAt?: string | null },
  skips: { originalDay: string; replacementDay: string | null }[]
): RefundDaysResult {
  const today = sub.cancelledAt ? new Date(sub.cancelledAt) : new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(sub.endDate);
  end.setDate(end.getDate() + 1); // make endDate inclusive in countWorkingDays
  const remainingDays = Math.max(0, countWorkingDays(today, end));

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

  return { refundDays, remainingDays, futureSkipsNoReplace, pastSkipsNoReplace };
}

/**
 * Calculate the prorated total due for a cancelled subscription.
 * For cancelled subs, totalDue should reflect only days used, not full plan price.
 * Extras with date ranges are pro-rated to only charge for the used portion.
 */
export function calculateProratedTotalDue(
  sub: { plan: string; subscriptionPrice: number; shippingPrice: number; discount: number; endDate: string; cancelledAt?: string | null },
  skips: { originalDay: string; replacementDay: string | null }[],
  extras: { amount: number; startDate: string | null; endDate: string | null }[]
): number {
  const totalDays = Math.max(1, planTotalMeals(sub.plan));
  const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
  const pricePerDay = effectiveTotal / totalDays;

  const refundInfo = calculateRefundDays(sub, skips);
  const daysUsed = Math.max(0, totalDays - refundInfo.refundDays);

  const cutoff = sub.cancelledAt ? new Date(sub.cancelledAt) : new Date();
  cutoff.setHours(0, 0, 0, 0);

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

  return Math.round(pricePerDay * daysUsed) + extrasCharged;
}

export interface SuggestedRefundResult {
  pricePerDay: number;
  totalDays: number;           // planTotalMeals(plan)
  remainingDays: number;
  futureSkipsNoReplace: number;
  pastSkipsNoReplace: number;
  refundDays: number;
  proRataRefund: number;
  extrasRefund: number;        // refund portion of period extras (remaining days)
  netPaid: number;
  suggested: number;           // min(proRataRefund + extrasRefund, netPaid), ≥0
  isCapped: boolean;
}

/**
 * Compute the suggested refund when cancelling a subscription.
 *
 * Formula (from subscription_page_plan.md):
 *   totalDays     = planTotalMeals(plan)
 *   pricePerDay   = (subscriptionPrice + shippingPrice - discount) / totalDays
 *   remainingDays = workingDaysRemainingInclusive(endDate)
 *   futureSkipsNoReplace = skips with originalDay >= today and no replacementDay
 *   pastSkipsNoReplace   = skips with originalDay < today and no replacementDay
 *   refundDays    = remainingDays - futureSkipsNoReplace + pastSkipsNoReplace
 *   proRata       = round(pricePerDay × refundDays)
 *   suggested     = max(0, min(proRata, netPaid))
 */
export function suggestedRefund(
  sub: {
    plan: string;
    subscriptionPrice: number;
    shippingPrice: number;
    discount: number;
    endDate: string;
  },
  skips: { originalDay: string; replacementDay: string | null }[],
  payments: { type: "payment" | "refund"; amount: number }[],
  asOf?: Date,
  extras: { amount: number; startDate: string | null; endDate: string | null }[] = []
): SuggestedRefundResult {
  const today = asOf ? new Date(asOf) : new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.max(1, planTotalMeals(sub.plan));
  const effectiveTotal = sub.subscriptionPrice + sub.shippingPrice - sub.discount;
  const pricePerDay = effectiveTotal / totalDays;

  // Count working days from the cancellation cutoff (inclusive) through endDate (inclusive).
  const end = new Date(sub.endDate);
  end.setDate(end.getDate() + 1); // make endDate inclusive in countWorkingDays
  const remainingDays = Math.max(0, countWorkingDays(today, end));

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
  const proRataRefund = Math.round(pricePerDay * refundDays);

  // Extras: refund the remaining portion of each period extra from cancelDate to endDate.
  // Clamp refund window start to max(cancelDate, extra.startDate) so cancelling before
  // the extra period doesn't produce a refund > the extra amount.
  // Also compensate for past skips (no replacement, or replacement outside the extra period)
  // whose originalDay fell inside the extra period — those days were never served.
  const extrasRefund = extras.reduce((s, e) => {
    if (!e.startDate || !e.endDate) return s; // undated extras are not auto-refunded
    const start = new Date(e.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(e.endDate); end.setHours(0, 0, 0, 0);
    const refundStart = new Date(Math.max(today.getTime(), start.getTime()));
    const endExcl = new Date(end.getTime() + 86_400_000);
    const totalDays = Math.max(1, countWorkingDays(start, endExcl));
    // Past skips within the extra period where the extra was never delivered:
    // no replacement at all, or replacement fell outside [start, end].
    // Computed before the early-return so a cancel after the period still
    // compensates for unserved skip days within it.
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
    pricePerDay: Math.round(pricePerDay),
    totalDays,
    remainingDays,
    futureSkipsNoReplace,
    pastSkipsNoReplace,
    refundDays,
    proRataRefund,
    extrasRefund,
    netPaid,
    suggested,
    isCapped,
  };
}
