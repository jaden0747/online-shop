"use server";

import { revalidatePath } from "next/cache";
import { upsertWeeklyOps } from "@/lib/data/operations";

export async function upsertWeeklyOpsAction(data: {
  weekLabel: string;
  mealsPrepared: number;
  mealsDelivered: number;
  wastedMeals: number;
  note?: string | null;
}): Promise<void> {
  upsertWeeklyOps(data);
  revalidatePath("/costs");
  revalidatePath("/");
}
