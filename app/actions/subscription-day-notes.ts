"use server";

import { revalidatePath } from "next/cache";
import { upsertSubscriptionDayNote } from "@/lib/data/subscription-day-notes";

export async function upsertSubscriptionDayNoteAction(
  subscriptionId: string,
  weekLabel: string,
  day: number,
  note: string,
): Promise<void> {
  upsertSubscriptionDayNote({ subscriptionId, weekLabel, day, note });
  revalidatePath("/shipping");
  revalidatePath("/customers");
}
