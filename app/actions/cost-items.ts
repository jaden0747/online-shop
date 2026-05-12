"use server";

import { revalidatePath } from "next/cache";
import { createCostItem, updateCostItem, deleteCostItem } from "@/lib/data/cost-items";

export async function createCostItemAction(data: {
  weekLabel: string;
  categoryId: string;
  amount: number;
  note?: string | null;
}): Promise<void> {
  createCostItem(data);
  revalidatePath("/costs");
}

export async function updateCostItemAction(
  id: string,
  data: { amount?: number; note?: string | null; categoryId?: string }
): Promise<void> {
  updateCostItem(id, data);
  revalidatePath("/costs");
}

export async function deleteCostItemAction(id: string): Promise<void> {
  deleteCostItem(id);
  revalidatePath("/costs");
}
