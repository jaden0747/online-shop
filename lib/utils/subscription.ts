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

export function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
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
