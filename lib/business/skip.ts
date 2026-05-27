/**
 * Canonical skip business logic shared by server actions and the assistant API.
 * Contains no Next.js dependencies (no revalidatePath, no "use server").
 */

import { createSkip, deleteSkip, getSubscriptionById, updateSubscription, getAllSkips } from "@/lib/data/subscriptions";
import { nextWorkingDay, addWorkingDays } from "@/lib/utils/subscription";
import { mealsForDate } from "@/lib/utils/schedule";

function toWeekday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

export type SkipResult =
  | { ok: true; skipId: string }
  | { ok: false; error: string };

/**
 * Create a skip with optional replacement day.
 * Extends the subscription end date by +1 working day when:
 *   - no replacement day is given, AND
 *   - the skip date is today or future
 */
export function createSkipWithExtension(data: {
  subscriptionId: string;
  originalDay: string;
  replacementDay?: string | null;
  reason?: string | null;
}): SkipResult {
  const sub = getSubscriptionById(data.subscriptionId);
  if (!sub) return { ok: false, error: "Subscription not found" };

  const replacementDay = data.replacementDay
    ? toWeekday(new Date(data.replacementDay))
    : null;

  const skip = createSkip({
    subscriptionId: data.subscriptionId,
    originalDay: new Date(data.originalDay).toISOString(),
    replacementDay: replacementDay?.toISOString() ?? null,
    reason: data.reason ?? null,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const skipDay = new Date(data.originalDay);
  skipDay.setHours(0, 0, 0, 0);

  if (!replacementDay && skipDay >= today) {
    const extended = nextWorkingDay(new Date(sub.endDate));
    updateSubscription(data.subscriptionId, { endDate: extended.toISOString() });
  }

  return { ok: true, skipId: skip.id };
}

/**
 * Skip a day and schedule it as a replacement at the current subscription end date,
 * then extend the end date by +1 working day.
 */
export function skipAndExtend(data: {
  subscriptionId: string;
  originalDay: string;
  reason?: string | null;
}): SkipResult {
  const sub = getSubscriptionById(data.subscriptionId);
  if (!sub) return { ok: false, error: "Subscription not found" };

  const newEnd = addWorkingDays(new Date(sub.endDate), 1);

  const skip = createSkip({
    subscriptionId: data.subscriptionId,
    originalDay: data.originalDay,
    replacementDay: newEnd.toISOString(),
    reason: data.reason ?? null,
  });

  updateSubscription(data.subscriptionId, { endDate: newEnd.toISOString() });

  return { ok: true, skipId: skip.id };
}

/**
 * Remove a skip and revert the end-date extension, but only when the
 * subscription's current end date still matches the skip's replacement day
 * (i.e. it has not been manually changed since).
 */
export function removeSkipAndRevert(skipId: string): { ok: boolean; error?: string } {
  const skip = deleteSkip(skipId);
  if (!skip) return { ok: false, error: "Skip not found" };

  const sub = getSubscriptionById(skip.subscriptionId);
  if (sub && skip.replacementDay) {
    const subEnd = new Date(sub.endDate);
    subEnd.setHours(0, 0, 0, 0);
    const skipReplacement = new Date(skip.replacementDay);
    skipReplacement.setHours(0, 0, 0, 0);
    if (subEnd.getTime() === skipReplacement.getTime()) {
      const shortenedEnd = addWorkingDays(subEnd, -1);
      updateSubscription(sub.id, { endDate: shortenedEnd.toISOString() });
    }
  }

  return { ok: true };
}

export type SkipValidationError =
  | "subscription_not_found"
  | "subscription_not_live"
  | "not_a_weekday"
  | "outside_subscription_period"
  | "skip_already_exists"
  | "zero_meal_day";

export function validateSkipDate(subscriptionId: string, dateStr: string): SkipValidationError | null {
  const sub = getSubscriptionById(subscriptionId);
  if (!sub) return "subscription_not_found";

  const date = new Date(dateStr + "T00:00:00");
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return "not_a_weekday";

  const start = new Date(sub.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(sub.endDate);
  end.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(0, 0, 0, 0);

  if (sub.status !== "active") return "subscription_not_live";
  if (d < start || d > end) return "outside_subscription_period";

  // Cannot skip a day that has 0 meals scheduled — nothing to skip.
  if (mealsForDate(sub, d) === 0) return "zero_meal_day";

  const existing = getAllSkips().find(
    (s) => s.subscriptionId === subscriptionId &&
      new Date(s.originalDay).toISOString().slice(0, 10) === dateStr
  );
  if (existing) return "skip_already_exists";

  return null;
}
