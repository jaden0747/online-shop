"use server";

import { revalidatePath } from "next/cache";
import { createSkip, deleteSkip, getAllSkips } from "@/lib/data/subscriptions";
import { updateSubscription, getSubscriptionById } from "@/lib/data/subscriptions";
import { nextWorkingDay } from "@/lib/utils/subscription";

export async function createMealSkipAction(formData: FormData) {
  const subscriptionId = formData.get("subscriptionId") as string;
  const originalDay = new Date(formData.get("originalDay") as string);
  const replacementDayRaw = formData.get("replacementDay") as string;
  const reason = (formData.get("reason") as string) || null;
  const replacementDay = replacementDayRaw ? new Date(replacementDayRaw) : null;

  createSkip({
    subscriptionId,
    originalDay: originalDay.toISOString(),
    replacementDay: replacementDay?.toISOString() ?? null,
    reason,
  });

  // Only extend renewal for present/future skips with no replacement.
  // Past skips are historical records — endDate already reflects the original plan.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const skipDay = new Date(originalDay);
  skipDay.setHours(0, 0, 0, 0);
  if (!replacementDay && skipDay >= today) {
    const sub = getSubscriptionById(subscriptionId);
    if (sub) {
      const extended = nextWorkingDay(new Date(sub.renewalDate));
      updateSubscription(subscriptionId, { renewalDate: extended.toISOString() });
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

  const replacement = nextWorkingDay(new Date(sub.renewalDate));

  createSkip({
    subscriptionId,
    originalDay: originalDay.toISOString(),
    replacementDay: replacement.toISOString(),
    reason: "quick skip",
  });

  updateSubscription(subscriptionId, { renewalDate: replacement.toISOString() });

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
      const extended = nextWorkingDay(new Date(sub.renewalDate));
      updateSubscription(subscriptionId, { renewalDate: extended.toISOString() });
    }
  }

  revalidatePath("/menu");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
}

export async function deleteMealSkipAction(id: string) {
  const skip = deleteSkip(id);
  if (!skip) return;

  // Only revert renewal extension for present/future skips — past skips never extended it.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const skipDay = new Date(skip.originalDay); skipDay.setHours(0, 0, 0, 0);
  const didExtend = skipDay >= today && (!skip.replacementDay || skip.reason === "quick skip");
  if (didExtend) {
    const sub = getSubscriptionById(skip.subscriptionId);
    if (sub) {
      const prevRenewal = new Date(sub.renewalDate);
      prevRenewal.setDate(prevRenewal.getDate() - 1);
      while (prevRenewal.getDay() === 0 || prevRenewal.getDay() === 6) {
        prevRenewal.setDate(prevRenewal.getDate() - 1);
      }
      updateSubscription(skip.subscriptionId, { renewalDate: prevRenewal.toISOString() });
    }
  }

  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}
