"use server";

import { revalidatePath } from "next/cache";
import { deleteSelection } from "@/lib/data/selections";
import { validateAndUpsertSelection, removeSelection } from "@/lib/business/selection";

export async function upsertSelectionAction(formData: FormData) {
  validateAndUpsertSelection({
    weekLabel: formData.get("weekLabel") as string,
    subscriptionId: formData.get("subscriptionId") as string,
    day: parseInt(formData.get("day") as string, 10),
    mealNum: parseInt(formData.get("mealNum") as string, 10),
    menuSlot: parseInt(formData.get("menuSlot") as string, 10),
  });
  revalidatePath("/menu");
}

export async function deleteSelectionAction(id: string) {
  deleteSelection(id);
  revalidatePath("/menu");
}

export async function upsertSelectionDirectAction(data: {
  weekLabel: string;
  subscriptionId: string;
  day: number;
  mealNum: number;
  menuSlot: number;
}): Promise<void> {
  validateAndUpsertSelection(data);
  revalidatePath("/menu");
  revalidatePath("/customers");
}

export async function deleteSelectionDirectAction(id: string): Promise<void> {
  removeSelection(id);
  revalidatePath("/menu");
  revalidatePath("/customers");
}
