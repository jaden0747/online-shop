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
import { deleteOrdersBySubscription } from "@/lib/data/orders";
import { addWorkingDays } from "@/lib/utils/subscription";

export async function createSubscriptionAction(formData: FormData) {
  const customerId = formData.get("customerId") as string;
  const plan = formData.get("plan") as string;
  const mealsPerDay = parseInt(formData.get("mealsPerDay") as string, 10);
  const subscriptionPrice = parseFloat(formData.get("subscriptionPrice") as string) || 0;
  const shippingPrice = parseFloat(formData.get("shippingPrice") as string) || 0;
  const trialDaysRaw = formData.get("trialDays");
  const trialDays = plan === "trial" && trialDaysRaw ? parseInt(trialDaysRaw as string, 10) : null;

  const startDateRaw = formData.get("startDate") as string;
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();
  let renewalDate: Date;
  if (plan === "weekly") renewalDate = addWorkingDays(startDate, 5);
  else if (plan === "monthly") renewalDate = addWorkingDays(startDate, 20);
  else renewalDate = addWorkingDays(startDate, trialDays ?? 3);

  createSubscription({
    customerId,
    plan,
    goal: formData.get("goal") as string,
    mealsPerDay,
    subscriptionPrice,
    shippingPrice,
    trialDays,
    status: "active",
    startDate: startDate.toISOString(),
    renewalDate: renewalDate.toISOString(),
    cancelReason: null,
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
    trialDays: number | null;
    startDate: Date;
    renewalDate: Date;
  }
) {
  updateSubscription(id, {
    ...data,
    startDate: data.startDate.toISOString(),
    renewalDate: data.renewalDate.toISOString(),
  });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function deleteSubscriptionAction(id: string) {
  deleteSubscription(id);
  deleteOrdersBySubscription(id);
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

export async function extendSubscriptionRenewalAction(id: string) {
  const sub = getSubscriptionById(id);
  if (!sub) return;
  const base = new Date(sub.renewalDate);
  const days = sub.plan === "weekly" ? 5 : sub.plan === "trial" ? (sub.trialDays ?? 3) : 20;
  updateSubscription(id, { renewalDate: addWorkingDays(base, days).toISOString() });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}
