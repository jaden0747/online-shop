"use server";

import { revalidatePath } from "next/cache";
import { upsertSelection, deleteSelection } from "@/lib/data/selections";

export async function upsertSelectionAction(formData: FormData) {
  upsertSelection({
    weekLabel: formData.get("weekLabel") as string,
    customerId: formData.get("customerId") as string,
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
  customerId: string;
  day: number;
  mealNum: number;
  menuSlot: number;
}): Promise<void> {
  upsertSelection(data);
  revalidatePath("/menu");
  revalidatePath("/customers");
}

export async function deleteSelectionDirectAction(id: string): Promise<void> {
  deleteSelection(id);
  revalidatePath("/menu");
  revalidatePath("/customers");
}
