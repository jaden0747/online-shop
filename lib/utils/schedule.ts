/**
 * Canonical schedule utilities for variable per-day meal distribution.
 *
 * Every function that needs to know "how many meals on day X" should go through
 * this module instead of reading `sub.mealsPerDay` directly.
 *
 * Backward compatibility: when `weeklyScheduleJson` is absent or null, every
 * weekday uses `mealsPerDay` — identical to the previous uniform behaviour.
 */

import type { MealDeliveryPlan, MealSkip, WeeklyMealSchedule } from "@/lib/data/types";

/** Minimal subscription shape needed for schedule calculations. */
export type SubSchedule = {
  id?: string;
  mealsPerDay: number;
  totalMeals?: number | null;
  startDate?: string;
  endDateNoSkip?: string | null;
  weeklyScheduleJson?: string | null;
};

function dateKey(date: Date | string): string {
  const d =
    typeof date === "string"
      ? new Date(date.length === 10 ? date + "T00:00:00" : date)
      : new Date(date);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeDate(date: Date | string): Date {
  const d =
    typeof date === "string"
      ? new Date(date.length === 10 ? date + "T00:00:00" : date)
      : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Parsing & serialisation ───────────────────────────────────────────────────

export function defaultWeeklySchedule(mealsPerDay: number): WeeklyMealSchedule {
  return { 1: mealsPerDay, 2: mealsPerDay, 3: mealsPerDay, 4: mealsPerDay, 5: mealsPerDay };
}

/**
 * Parse a JSON string into a WeeklyMealSchedule, falling back to uniform
 * `mealsPerDay` for any missing or invalid day.
 */
export function parseWeeklySchedule(
  json: string | null | undefined,
  mealsPerDay: number
): WeeklyMealSchedule {
  if (!json) return defaultWeeklySchedule(mealsPerDay);
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const toInt = (v: unknown, fallback: number) => {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return isNaN(n) || n < 0 ? fallback : n;
    };
    return {
      1: toInt(parsed["1"], mealsPerDay),
      2: toInt(parsed["2"], mealsPerDay),
      3: toInt(parsed["3"], mealsPerDay),
      4: toInt(parsed["4"], mealsPerDay),
      5: toInt(parsed["5"], mealsPerDay),
    };
  } catch {
    return defaultWeeklySchedule(mealsPerDay);
  }
}

export function serializeWeeklySchedule(schedule: WeeklyMealSchedule): string {
  return JSON.stringify(schedule);
}

/** Sum of all five days in a WeeklyMealSchedule. */
export function weeklyScheduleTotal(schedule: WeeklyMealSchedule): number {
  return schedule[1] + schedule[2] + schedule[3] + schedule[4] + schedule[5];
}

// ── Per-day meal counts ───────────────────────────────────────────────────────

/**
 * Meals scheduled for a given day-of-week (1 = Mon, 2 = Tue, … 5 = Fri).
 * Returns 0 for weekends or out-of-range values.
 */
export function mealsForDayOfWeek(sub: SubSchedule, dayOfWeek: number): number {
  if (dayOfWeek < 1 || dayOfWeek > 5) return 0;
  const schedule = parseWeeklySchedule(sub.weeklyScheduleJson, sub.mealsPerDay);
  return schedule[dayOfWeek as 1 | 2 | 3 | 4 | 5];
}

/**
 * Meals scheduled for a specific calendar date.
 * Returns 0 on weekends (no delivery).
 */
export function mealsForDate(sub: SubSchedule, date: Date | string): number {
  const d =
    typeof date === "string"
      ? new Date(date.length === 10 ? date + "T00:00:00" : date)
      : new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sun, 6 = Sat
  if (dow === 0 || dow === 6) return 0;
  return mealsForDayOfWeek(sub, dow);
}

export function explicitMealPlanForDate(
  plans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[],
  subscriptionId: string,
  date: Date | string
): Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals"> | null {
  const key = dateKey(date);
  return plans.find((p) => p.subscriptionId === subscriptionId && dateKey(p.date) === key) ?? null;
}

export function isSkippedDate(
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[],
  subscriptionId: string,
  date: Date | string
): boolean {
  const key = dateKey(date);
  return skips.some((sk) => sk.subscriptionId === subscriptionId && dateKey(sk.originalDay) === key);
}

export function plannedMealsForDate(
  sub: SubSchedule & { id: string },
  date: Date | string,
  plans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = [],
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[] = []
): number {
  if (isSkippedDate(skips, sub.id, date)) return 0;
  const explicit = explicitMealPlanForDate(plans, sub.id, date);
  if (explicit) return Math.max(0, Math.floor(explicit.plannedMeals));
  return mealsForDate(sub, date);
}

export function totalMealEntitlement(sub: SubSchedule): number {
  if (sub.totalMeals && sub.totalMeals > 0) return Math.floor(sub.totalMeals);
  if (sub.startDate && sub.endDateNoSkip) {
    return totalScheduledMeals(sub, normalizeDate(sub.startDate), normalizeDate(sub.endDateNoSkip));
  }
  return weeklyScheduleTotal(parseWeeklySchedule(sub.weeklyScheduleJson, sub.mealsPerDay));
}

export function plannedMealsBeforeDate(
  sub: SubSchedule & { id: string; startDate: string },
  date: Date | string,
  plans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = [],
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[] = []
): number {
  const target = normalizeDate(date);
  const cur = normalizeDate(sub.startDate);
  let total = 0;
  let guard = 0;
  while (cur < target && guard < 1500) {
    total += plannedMealsForDate(sub, cur, plans, skips);
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return total;
}

export function projectedEndDateForSubscription(
  sub: SubSchedule & { id: string; startDate: string },
  plans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = [],
  skips: Pick<MealSkip, "subscriptionId" | "originalDay">[] = []
): Date {
  const entitlement = totalMealEntitlement(sub);
  const cur = normalizeDate(sub.startDate);
  let consumed = 0;
  let lastDelivery = new Date(cur);
  let guard = 0;

  while (consumed < entitlement && guard < 1500) {
    const meals = plannedMealsForDate(sub, cur, plans, skips);
    if (meals > 0) {
      consumed += meals;
      lastDelivery = new Date(cur);
    }
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }

  return lastDelivery;
}

// ── Range aggregates ──────────────────────────────────────────────────────────

/**
 * Total meals scheduled in [from, to] (both inclusive), ignoring skips.
 * This is the "planned" total — what the subscription promises to deliver.
 */
export function totalScheduledMeals(sub: SubSchedule, from: Date, to: Date): number {
  let total = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    total += mealsForDate(sub, cur);
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

/**
 * Meals actually served in [from, to] (both inclusive), accounting for skips.
 *
 * A skipped day contributes 0 meals regardless of replacement; replacement days
 * are ordinary weekdays and are counted by their own scheduled meal count.
 * (Replacement days are NOT in the `skips` array as `originalDay`, so they are
 * counted normally by the loop.)
 *
 * @param skips - Already filtered to the relevant subscription (no subscriptionId check here).
 */
export function servedMealsInRange(
  sub: SubSchedule,
  skips: { originalDay: string }[],
  from: Date,
  to: Date,
  plans: Pick<MealDeliveryPlan, "subscriptionId" | "date" | "plannedMeals">[] = []
): number {
  const skippedDates = new Set(
    skips.map((sk) => {
      const d = new Date(sk.originalDay);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })
  );

  let total = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    if (!skippedDates.has(dateStr)) {
      if (sub.id) {
        total += plannedMealsForDate(sub as SubSchedule & { id: string }, cur, plans, []);
      } else {
        total += mealsForDate(sub, cur);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  return total;
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate that a WeeklyMealSchedule is consistent with a subscription's plan.
 * Returns null if valid, or an error message string.
 *
 * - Values must be non-negative integers.
 * - For weekly/monthly plans the weekly sum must equal `mealsPerDay × 5`.
 * - Trial plans do not support custom schedules.
 */
export function validateWeeklySchedule(
  schedule: WeeklyMealSchedule,
  plan: string,
  mealsPerDay: number
): string | null {
  for (const day of [1, 2, 3, 4, 5] as const) {
    if (!Number.isInteger(schedule[day]) || schedule[day] < 0) {
      return `Day ${day} must be a non-negative integer`;
    }
  }
  if (plan === "trial") return "Trial plans do not support custom schedules";
  const expected = mealsPerDay * 5;
  const actual = weeklyScheduleTotal(schedule);
  if (actual !== expected) {
    return `Schedule total (${actual}) must equal mealsPerDay × 5 (${expected})`;
  }
  return null;
}
