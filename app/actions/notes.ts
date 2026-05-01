"use server";

import { revalidatePath } from "next/cache";
import { upsertNote } from "@/lib/data/notes";

export async function upsertKitchenNoteAction(
  weekLabel: string,
  customerId: string,
  day: number,
  note: string,
) {
  upsertNote({ weekLabel, customerId, day, note });
  revalidatePath("/menu");
}
