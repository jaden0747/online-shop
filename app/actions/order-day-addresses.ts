"use server";

import { revalidatePath } from "next/cache";
import { upsertDayAddress, deleteDayAddress } from "@/lib/data/order-day-addresses";

export async function upsertDayAddressAction(
  subscriptionId: string,
  weekLabel: string,
  day: number,
  addressId: string
): Promise<void> {
  upsertDayAddress(subscriptionId, weekLabel, day, addressId);
  revalidatePath("/customers");
  revalidatePath("/menu");
  revalidatePath("/shipping");
}

export async function deleteDayAddressAction(
  subscriptionId: string,
  weekLabel: string,
  day: number
): Promise<void> {
  deleteDayAddress(subscriptionId, weekLabel, day);
  revalidatePath("/customers");
  revalidatePath("/menu");
  revalidatePath("/shipping");
}
