"use server";

import { revalidatePath } from "next/cache";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from "@/lib/data/subscriptions";
import { deleteOrdersBySubscription } from "@/lib/data/orders";
import { planTotalMeals, addWorkingDays } from "@/lib/utils/subscription";

export async function createSubscriptionAction(formData: FormData) {
  const customerId = formData.get("customerId") as string;
  const plan = formData.get("plan") as string;
  const mealsPerDay = parseInt(formData.get("mealsPerDay") as string, 10);
  const packagePrice = parseFloat(formData.get("packagePrice") as string);
  const totalMeals = planTotalMeals(plan) * mealsPerDay;
  const pricePerMeal = packagePrice / totalMeals;

  const startDateRaw = formData.get("startDate") as string;
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();
  let renewalDate: Date;
  if (plan === "weekly") renewalDate = addWorkingDays(startDate, 5);
  else if (plan === "monthly") renewalDate = addWorkingDays(startDate, 20);
  else renewalDate = addWorkingDays(startDate, 3);

  createSubscription({
    customerId,
    plan,
    goal: formData.get("goal") as string,
    mealsPerDay,
    packagePrice,
    pricePerMeal,
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
    packagePrice: number;
    pricePerMeal: number;
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
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}
