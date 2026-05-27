"use server";

import { revalidatePath } from "next/cache";
import { deleteSkip, getAllSkips, getSubscriptionById } from "@/lib/data/subscriptions";
import { createSkip } from "@/lib/data/subscriptions";
import { nextWorkingDay } from "@/lib/utils/subscription";
import {
  createSkipWithExtension,
  removeSkipAndRevert,
} from "@/lib/business/skip";
import { recalculateSubscriptionEndDate } from "@/lib/business/meal-delivery-plans";

function revalidateAll() {
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/shipping");
  revalidatePath("/menu");
  revalidatePath("/");
}

export async function createMealSkipAction(formData: FormData) {
  const subscriptionId = formData.get("subscriptionId") as string;
  const originalDay = formData.get("originalDay") as string;
  const replacementDayRaw = formData.get("replacementDay") as string;
  const reason = (formData.get("reason") as string) || null;

  createSkipWithExtension({
    subscriptionId,
    originalDay,
    replacementDay: replacementDayRaw || null,
    reason,
  });
  recalculateSubscriptionEndDate(subscriptionId);

  revalidateAll();
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
  recalculateSubscriptionEndDate(subscriptionId);

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}

/** Create a skip directly from the menu grid (no replacement day). */
export async function skipDayFromMenuAction(subscriptionId: string, originalDay: string) {
  createSkipWithExtension({ subscriptionId, originalDay, replacementDay: null, reason: null });
  recalculateSubscriptionEndDate(subscriptionId);
  revalidatePath("/menu");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function createSkipDirectAction(data: {
  subscriptionId: string;
  originalDay: string;
  replacementDay: string | null;
  reason: string | null;
}): Promise<void> {
  createSkipWithExtension(data);
  recalculateSubscriptionEndDate(data.subscriptionId);
  revalidateAll();
}

export async function deleteMealSkipAction(id: string) {
  const skip = deleteSkip(id);
  if (!skip) return;

  // Only revert end date extension for present/future skips — past skips never extended it.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const skipDay = new Date(skip.originalDay);
  skipDay.setHours(0, 0, 0, 0);
  const didExtend = skipDay >= today && (!skip.replacementDay || skip.reason === "quick skip");
  if (didExtend) {
    const sub = getSubscriptionById(skip.subscriptionId);
    if (sub) {
      const prevEnd = new Date(sub.endDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      while (prevEnd.getDay() === 0 || prevEnd.getDay() === 6) {
        prevEnd.setDate(prevEnd.getDate() - 1);
      }
      const { updateSubscription } = await import("@/lib/data/subscriptions");
      updateSubscription(skip.subscriptionId, { endDate: prevEnd.toISOString() });
    }
  }
  recalculateSubscriptionEndDate(skip.subscriptionId);

  revalidateAll();
}

/** Skip a specific day and auto-extend end date by +1 working day. */
export async function skipDayAndExtendAction(
  subscriptionId: string,
  originalDay: string,
  reason?: string | null
): Promise<void> {
  createSkipWithExtension({ subscriptionId, originalDay, replacementDay: null, reason });
  recalculateSubscriptionEndDate(subscriptionId);
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}

/**
 * Remove a skip and roll back the end date by -1 working day if the
 * end date still matches the skip's replacement day.
 */
export async function unskipDayAndShortenAction(skipId: string): Promise<void> {
  const existing = getAllSkips().find((sk) => sk.id === skipId);
  removeSkipAndRevert(skipId);
  if (existing) recalculateSubscriptionEndDate(existing.subscriptionId);
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}
