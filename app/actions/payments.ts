"use server";

import { revalidatePath } from "next/cache";
import { createPayment, updatePayment, deletePayment } from "@/lib/data/payments";
import type { Payment } from "@/lib/data/types";

export async function createPaymentAction(data: {
  subscriptionId: string;
  type: Payment["type"];
  amount: number;
  paidAt: string;
  method: Payment["method"];
  note?: string | null;
}): Promise<void> {
  createPayment({
    subscriptionId: data.subscriptionId,
    type: data.type,
    amount: data.amount,
    paidAt: data.paidAt,
    method: data.method,
    note: data.note ?? null,
  });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function updatePaymentAction(
  id: string,
  data: {
    amount?: number;
    paidAt?: string;
    method?: Payment["method"];
    note?: string | null;
  }
): Promise<void> {
  updatePayment(id, data);
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

export async function deletePaymentAction(id: string): Promise<void> {
  deletePayment(id);
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}
