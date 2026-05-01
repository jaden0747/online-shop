"use server";

import { revalidatePath } from "next/cache";
import { upsertPricing, deletePricing } from "@/lib/data/pricing";

export async function upsertPricingAction(formData: FormData) {
  upsertPricing({
    goal: formData.get("goal") as string,
    plan: formData.get("plan") as string,
    mealsPerDay: parseInt(formData.get("mealsPerDay") as string, 10),
    totalPrice: parseFloat(formData.get("totalPrice") as string),
  });
  revalidatePath("/subscriptions");
}

export async function deletePricingAction(id: string) {
  deletePricing(id);
  revalidatePath("/subscriptions");
}
