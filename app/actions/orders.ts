"use server";

import { revalidatePath } from "next/cache";
import { updateOrderStatus, createOrder, setOrderMeals, getAllOrders, updateOrderAddress } from "@/lib/data/orders";

export async function updateOrderStatusAction(id: string, status: string) {
  updateOrderStatus(id, status);
  revalidatePath("/customers");
}

export async function createOrderAction(formData: FormData) {
  const addressId = formData.get("addressId") as string | null;
  createOrder({
    subscriptionId: formData.get("subscriptionId") as string,
    weekLabel: formData.get("weekLabel") as string,
    addressId: addressId || null,
  });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function upsertWeekOrderAddressAction(
  subscriptionId: string,
  weekLabel: string,
  addressId: string | null
): Promise<void> {
  const existing = getAllOrders().find(
    (o) => o.subscriptionId === subscriptionId && o.weekLabel === weekLabel
  );
  if (existing) {
    updateOrderAddress(existing.id, addressId);
  } else {
    createOrder({ subscriptionId, weekLabel, addressId });
  }
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function setOrderMealsAction(
  orderId: string,
  selections: {
    day: number;
    mealSlot: number;
    menuItemId: string | null;
    quantity?: number;
    notes?: string;
  }[],
  addressId?: string | null
) {
  setOrderMeals(orderId, selections, addressId);
  revalidatePath("/customers");
}
