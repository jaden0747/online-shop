"use server";

import { revalidatePath } from "next/cache";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscriptionById,
  createExtra,
  updateExtra,
  deleteExtra,
  deleteExtrasBySubscription,
} from "@/lib/data/subscriptions";
import { addWorkingDays } from "@/lib/utils/subscription";

export async function createSubscriptionAction(formData: FormData) {
  const customerId = formData.get("customerId") as string;
  const plan = formData.get("plan") as string;
  const mealsPerDay = parseInt(formData.get("mealsPerDay") as string, 10);
  const subscriptionPrice = parseFloat(formData.get("subscriptionPrice") as string) || 0;
  const shippingPrice = parseFloat(formData.get("shippingPrice") as string) || 0;
  const discount = parseFloat(formData.get("discount") as string) || 0;
  const trialDaysRaw = formData.get("trialDays");
  const trialDays = plan === "trial" && trialDaysRaw ? parseInt(trialDaysRaw as string, 10) : null;

  const startDateRaw = formData.get("startDate") as string;
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();

  // Use manual end date if provided, otherwise auto-compute
  const endDateRaw = formData.get("endDate") as string;
  let endDate: Date;
  if (endDateRaw) {
    endDate = new Date(endDateRaw);
  } else if (plan === "weekly") endDate = addWorkingDays(startDate, 4);
  else if (plan === "monthly") endDate = addWorkingDays(startDate, 19);
  else endDate = addWorkingDays(startDate, (trialDays ?? 3) - 1);

  const addressIdRaw = formData.get("addressId") as string | null;
  const addressId = addressIdRaw && addressIdRaw !== "none" ? addressIdRaw : null;

  createSubscription({
    customerId,
    plan,
    goal: formData.get("goal") as string,
    mealsPerDay,
    subscriptionPrice,
    shippingPrice,
    discount,
    trialDays,
    status: "active",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    endDateNoSkip: endDate.toISOString(),
    cancelReason: null,
    addressId,
  });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function updateSubscriptionStatusAction(
  id: string,
  status: string,
  cancelReason?: string
) {
  updateSubscription(id, { status, cancelReason: cancelReason ?? null });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function updateSubscriptionAction(
  id: string,
  data: {
    plan: string;
    goal: string;
    mealsPerDay: number;
    subscriptionPrice: number;
    shippingPrice: number;
    discount: number;
    trialDays: number | null;
    startDate: Date;
    endDate: Date;
    endDateNoSkip: Date;
    addressId: string | null;
  }
) {
  updateSubscription(id, {
    ...data,
    startDate: data.startDate.toISOString(),
    endDate: data.endDate.toISOString(),
    endDateNoSkip: data.endDateNoSkip.toISOString(),
  });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function deleteSubscriptionAction(id: string) {
  deleteSubscription(id);
  deleteExtrasBySubscription(id);
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function createExtraAction(formData: FormData) {
  const subscriptionId = formData.get("subscriptionId") as string;
  const amount = parseFloat(formData.get("amount") as string) || 0;
  const note = (formData.get("note") as string) || null;
  createExtra({ subscriptionId, amount, note });
  revalidatePath("/subscriptions");
}

export async function updateExtraAction(id: string, data: { amount: number; note: string | null }) {
  updateExtra(id, data);
  revalidatePath("/subscriptions");
}

export async function deleteExtraAction(id: string) {
  deleteExtra(id);
  revalidatePath("/subscriptions");
}

export async function extendSubscriptionEndAction(id: string) {
  const sub = getSubscriptionById(id);
  if (!sub) return;
  const base = new Date(sub.endDate);
  const days = sub.plan === "weekly" ? 5 : sub.plan === "trial" ? (sub.trialDays ?? 3) : 20;
  updateSubscription(id, { endDate: addWorkingDays(base, days).toISOString() });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}
