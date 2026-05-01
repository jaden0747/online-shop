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

export function daysRemaining(renewalDate: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((renewal.getTime() - now.getTime()) / 86400000));
}

export function workingDaysRemaining(renewalDate: Date | string): number {
  return countWorkingDays(new Date(), new Date(renewalDate));
}

/** Meals left = working days from today to endDate × mealsPerDay. */
export function mealsRemaining(endDate: Date | string, mealsPerDay: number): number {
  return Math.max(0, countWorkingDays(new Date(), new Date(endDate)) * mealsPerDay);
}

/** A subscription is live when today falls within [startDate, endDate] and it is not cancelled or paused. */
export function isSubscriptionLive(status: string, startDate: Date | string, endDate: Date | string): boolean {
  if (status === "cancelled" || status === "paused") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return today >= start && today <= end;
}

/** Returns a derived display status based on dates, overriding with manual cancel/pause. */
export function subscriptionStatus(status: string, startDate: Date | string, endDate: Date | string): string {
  if (status === "cancelled") return "cancelled";
  if (status === "paused") return "paused";
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

/** Returns the date after `n` working days (Mon–Fri) from `from` (inclusive of from if it's a working day). */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() >= 1 && d.getDay() <= 5) added++;
  }
  return d;
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
