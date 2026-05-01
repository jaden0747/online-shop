"use server";

import { revalidatePath } from "next/cache";
import { upsertMenuItem, deleteMenuItem } from "@/lib/data/menu";

export async function upsertMenuItemAction(formData: FormData) {
  upsertMenuItem({
    weekLabel: formData.get("weekLabel") as string,
    day: parseInt(formData.get("day") as string, 10),
    slot: parseInt(formData.get("slot") as string, 10),
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || null,
    calories: formData.get("calories")
      ? parseInt(formData.get("calories") as string, 10)
      : null,
    protein: formData.get("protein")
      ? parseFloat(formData.get("protein") as string)
      : null,
    goals: formData.get("goals") as string,
  });
  revalidatePath("/menu");
}

export async function deleteMenuItemAction(id: string) {
  deleteMenuItem(id);
  revalidatePath("/menu");
}
