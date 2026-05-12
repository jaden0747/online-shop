"use server";

import { revalidatePath } from "next/cache";
import {
  createCostCategory,
  updateCostCategory,
  deleteCostCategory,
} from "@/lib/data/cost-categories";

export async function createCostCategoryAction(data: { name: string }): Promise<void> {
  if (!data.name.trim()) return;
  createCostCategory({ name: data.name.trim() });
  revalidatePath("/settings");
  revalidatePath("/costs");
}

export async function updateCostCategoryAction(
  id: string,
  data: { name?: string; sortOrder?: number }
): Promise<void> {
  updateCostCategory(id, data);
  revalidatePath("/settings");
  revalidatePath("/costs");
}

export async function deleteCostCategoryAction(id: string): Promise<void> {
  deleteCostCategory(id);
  revalidatePath("/settings");
  revalidatePath("/costs");
}
