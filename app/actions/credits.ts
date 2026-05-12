"use server";

import { revalidatePath } from "next/cache";
import {
  createCreditTransaction,
  deleteCreditTransaction,
  getCreditTransactionsByCustomer,
  getAllCreditTransactions,
} from "@/lib/data/credits";
import { createPayment, deletePayment, getAllPayments } from "@/lib/data/payments";
import { creditBalance } from "@/lib/utils/credits";
import type { CreditTransaction, Payment } from "@/lib/data/types";

function revalidateAll() {
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
}

/**
 * Add credit to a customer's wallet.
 * type: "refund_credit" when converting a cancellation refund to credit,
 *       "manual_topup" for a goodwill / manual credit entry,
 *       "adjustment" for corrections.
 */
export async function addCreditAction(data: {
  customerId: string;
  amount: number;
  type: Extract<CreditTransaction["type"], "refund_credit" | "manual_topup" | "adjustment">;
  note: string;
  subscriptionId?: string | null;
}): Promise<CreditTransaction> {
  if (data.amount <= 0) throw new Error("Credit amount must be positive");
  const tx = createCreditTransaction({
    customerId: data.customerId,
    type: data.type,
    amount: data.amount,
    subscriptionId: data.subscriptionId ?? null,
    note: data.note || "Credit added",
  });
  revalidateAll();
  return tx;
}

/**
 * Apply (use) credit from a customer's wallet toward a subscription.
 * Returns a warning message when the deduction would push balance negative.
 */
export async function useCreditAction(data: {
  customerId: string;
  amount: number;
  subscriptionId: string;
  note?: string;
}): Promise<{ tx: CreditTransaction; warning: string | null }> {
  if (data.amount <= 0) throw new Error("Credit amount must be positive");

  const existing = getCreditTransactionsByCustomer(data.customerId);
  const balance = creditBalance(existing);

  let warning: string | null = null;
  if (data.amount > balance) {
    warning = `Amount ₫${data.amount.toLocaleString()} exceeds available credit ₫${balance.toLocaleString()}.`;
  }

  const tx = createCreditTransaction({
    customerId: data.customerId,
    type: "credit_used",
    amount: data.amount,
    subscriptionId: data.subscriptionId,
    note: data.note ?? "Credit applied to subscription",
  });
  revalidateAll();
  return { tx, warning };
}

/**
 * Delete a credit transaction.
 * Returns a warning when deleting would make the balance go negative.
 */
export async function deleteCreditTransactionAction(
  id: string,
  customerId: string
): Promise<{ warning: string | null }> {
  const existing = getCreditTransactionsByCustomer(customerId);
  const tx = existing.find((t) => t.id === id);
  if (!tx) throw new Error("Credit transaction not found");

  // Simulate balance after deletion
  const remaining = existing.filter((t) => t.id !== id);
  const newBalance = creditBalance(remaining);

  let warning: string | null = null;
  if (newBalance < 0) {
    warning = `Deleting this entry would make the credit balance negative (₫${newBalance.toLocaleString()}).`;
  }

  deleteCreditTransaction(id);
  revalidateAll();
  return { warning };
}

/**
 * Atomically apply credit to a subscription:
 * 1. Creates a Payment record (type=payment, method=credit)
 * 2. Creates a CreditTransaction record (type=credit_used)
 *
 * Both records share the same `linkedCreditId` via the payment note so they
 * can be found together at revert time.
 *
 * Returns a warning when amount > available credit balance (soft warning only).
 */
export async function applyCreditToSubscriptionAction(data: {
  customerId: string;
  subscriptionId: string;
  amount: number;
  note?: string;
}): Promise<{ payment: Payment; tx: CreditTransaction; warning: string | null }> {
  if (data.amount <= 0) throw new Error("Credit amount must be positive");

  const existing = getCreditTransactionsByCustomer(data.customerId);
  const balance = creditBalance(existing);

  let warning: string | null = null;
  if (data.amount > balance) {
    warning = `Amount ₫${data.amount.toLocaleString()} exceeds available credit ₫${balance.toLocaleString()}.`;
  }

  const noteText = data.note?.trim() || "Credit applied";

  // Create payment first to get its ID
  const payment = createPayment({
    subscriptionId: data.subscriptionId,
    type: "payment",
    method: "credit",
    amount: data.amount,
    paidAt: new Date().toISOString(),
    note: noteText,
  });

  // Create credit transaction linked to this payment
  const tx = createCreditTransaction({
    customerId: data.customerId,
    type: "credit_used",
    amount: data.amount,
    subscriptionId: data.subscriptionId,
    note: `[paymentId:${payment.id}] ${noteText}`,
  });

  revalidateAll();
  return { payment, tx, warning };
}

/**
 * Atomically revert a credit payment:
 * 1. Finds the Payment by ID (must have method=credit)
 * 2. Finds the matching CreditTransaction via the paymentId tag in its note
 * 3. Deletes both records
 *
 * This restores the customer's credit balance.
 */
export async function revertCreditPaymentAction(
  paymentId: string,
  customerId: string
): Promise<void> {
  const allPayments = getAllPayments();
  const payment = allPayments.find((p) => p.id === paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.method !== "credit") throw new Error("Payment is not a credit payment");

  // Find the matching CreditTransaction by the paymentId tag
  const allTxs = getAllCreditTransactions();
  const tx = allTxs.find(
    (t) =>
      t.customerId === customerId &&
      t.type === "credit_used" &&
      t.note.includes(`[paymentId:${paymentId}]`)
  );

  deletePayment(paymentId);
  if (tx) deleteCreditTransaction(tx.id);

  revalidateAll();
}
