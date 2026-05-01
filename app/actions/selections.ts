"use server";

import { revalidatePath } from "next/cache";
import { upsertSelection } from "@/lib/data/selections";

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
