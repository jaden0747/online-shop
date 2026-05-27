"use server";

import { revalidatePath } from "next/cache";
import { updateMealPlanForDate } from "@/lib/business/meal-delivery-plans";

function revalidateMealPlanConsumers() {
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/menu");
  revalidatePath("/shipping");
  revalidatePath("/");
}

export async function updateMealPlanForDateAction(data: {
  subscriptionId: string;
  date: string;
  plannedMeals: number;
  reason?: string | null;
}) {
  const result = updateMealPlanForDate(data);
  revalidateMealPlanConsumers();
  return result;
}
