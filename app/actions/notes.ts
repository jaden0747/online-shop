"use server";

import { revalidatePath } from "next/cache";
import { upsertNote } from "@/lib/data/notes";
import { upsertSubscriptionDayNote } from "@/lib/data/subscription-day-notes";

export async function upsertKitchenNoteAction(
  weekLabel: string,
  customerId: string,
  day: number,
  note: string,
) {
  upsertNote({ weekLabel, customerId, day, note });
  revalidatePath("/menu");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function upsertSubscriptionDayNoteAction(
  subscriptionId: string,
  weekLabel: string,
  day: number,
  note: string,
) {
  upsertSubscriptionDayNote({ subscriptionId, weekLabel, day, note });
  revalidatePath("/menu");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}
