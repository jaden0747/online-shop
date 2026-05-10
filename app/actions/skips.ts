"use server";

import { revalidatePath } from "next/cache";
import { createSkip, deleteSkip, getAllSkips } from "@/lib/data/subscriptions";
import { updateSubscription, getSubscriptionById } from "@/lib/data/subscriptions";
import { nextWorkingDay, addWorkingDays } from "@/lib/utils/subscription";

/** If `d` falls on a weekend, advance to the next Monday. Otherwise return as-is. */
function toWeekday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

export async function createMealSkipAction(formData: FormData) {
  const subscriptionId = formData.get("subscriptionId") as string;
  const originalDay = new Date(formData.get("originalDay") as string);
  const replacementDayRaw = formData.get("replacementDay") as string;
  const reason = (formData.get("reason") as string) || null;
  const replacementDay = replacementDayRaw ? toWeekday(new Date(replacementDayRaw)) : null;

  createSkip({
    subscriptionId,
    originalDay: originalDay.toISOString(),
    replacementDay: replacementDay?.toISOString() ?? null,
    reason,
  });

  // Only extend end date for present/future skips with no replacement.
  // Past skips are historical records — endDate already reflects the original plan.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const skipDay = new Date(originalDay);
  skipDay.setHours(0, 0, 0, 0);
  if (!replacementDay && skipDay >= today) {
    const sub = getSubscriptionById(subscriptionId);
    if (sub) {
      const extended = nextWorkingDay(new Date(sub.endDate));
      updateSubscription(subscriptionId, { endDate: extended.toISOString() });
    }
  }

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

/** Skip today (or next working day if called on a weekend); reschedule to end of subscription. */
export async function skipTodayToNextAction(subscriptionId: string) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const originalDay =
    now.getDay() === 0 || now.getDay() === 6 ? nextWorkingDay(now) : now;

  const sub = getSubscriptionById(subscriptionId);
  if (!sub) return;

  const replacement = nextWorkingDay(new Date(sub.endDate));

  createSkip({
    subscriptionId,
    originalDay: originalDay.toISOString(),
    replacementDay: replacement.toISOString(),
    reason: "quick skip",
  });

  updateSubscription(subscriptionId, { endDate: replacement.toISOString() });

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}

/** Create a skip directly from the menu grid (no replacement day). */
export async function skipDayFromMenuAction(subscriptionId: string, originalDay: string) {
  createSkip({ subscriptionId, originalDay, replacementDay: null, reason: null });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const skipDay = new Date(originalDay);
  skipDay.setHours(0, 0, 0, 0);

  if (skipDay >= today) {
    const sub = getSubscriptionById(subscriptionId);
    if (sub) {
      const extended = nextWorkingDay(new Date(sub.endDate));
      updateSubscription(subscriptionId, { endDate: extended.toISOString() });
    }
  }

  revalidatePath("/menu");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}

export async function createSkipDirectAction(data: {
  subscriptionId: string;
  originalDay: string;
  replacementDay: string | null;
  reason: string | null;
}): Promise<void> {
  const originalDay = new Date(data.originalDay);
  const replacementDay = data.replacementDay ? toWeekday(new Date(data.replacementDay)) : null;

  createSkip({
    subscriptionId: data.subscriptionId,
    originalDay: originalDay.toISOString(),
    replacementDay: replacementDay?.toISOString() ?? null,
    reason: data.reason,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const skipDay = new Date(data.originalDay);
  skipDay.setHours(0, 0, 0, 0);
  if (!replacementDay && skipDay >= today) {
    const sub = getSubscriptionById(data.subscriptionId);
    if (sub) {
      const extended = nextWorkingDay(new Date(sub.endDate));
      updateSubscription(data.subscriptionId, { endDate: extended.toISOString() });
    }
  }

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function deleteMealSkipAction(id: string) {
  const skip = deleteSkip(id);
  if (!skip) return;

  // Only revert end date extension for present/future skips — past skips never extended it.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const skipDay = new Date(skip.originalDay); skipDay.setHours(0, 0, 0, 0);
  const didExtend = skipDay >= today && (!skip.replacementDay || skip.reason === "quick skip");
  if (didExtend) {
    const sub = getSubscriptionById(skip.subscriptionId);
    if (sub) {
      const prevEnd = new Date(sub.endDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      while (prevEnd.getDay() === 0 || prevEnd.getDay() === 6) {
        prevEnd.setDate(prevEnd.getDate() - 1);
      }
      updateSubscription(skip.subscriptionId, { endDate: prevEnd.toISOString() });
    }
  }

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

/**
 * Skip a specific day and auto-extend the subscription end date by +1 working day.
 * replacementDay is set to the new endDate (before extension).
 */
export async function skipDayAndExtendAction(
  subscriptionId: string,
  originalDay: string,
  reason?: string | null
): Promise<void> {
  const sub = getSubscriptionById(subscriptionId);
  if (!sub) return;

  const newEnd = addWorkingDays(new Date(sub.endDate), 1);

  createSkip({
    subscriptionId,
    originalDay,
    replacementDay: newEnd.toISOString(),
    reason: reason ?? null,
  });

  updateSubscription(subscriptionId, { endDate: newEnd.toISOString() });

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}

/**
 * Remove a skip and safely roll back the subscription end date by -1 working day,
 * but only when endDate still matches the skip's replacementDay (i.e. not manually edited).
 */
export async function unskipDayAndShortenAction(skipId: string): Promise<void> {
  const skip = deleteSkip(skipId);
  if (!skip) return;

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

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}
