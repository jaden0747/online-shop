import { readRows, writeRows, toStr, toStrOrNull, toNum, parseExcelDate } from "./excel";
import type { Payment, Subscription, SubscriptionExtra } from "./types";
import { paymentsTotalForSub, subscriptionPaymentStatus } from "@/lib/utils/payments";

export { paymentsTotalForSub, subscriptionPaymentStatus };

const FILE = "payments.xlsx";
const SHEET = "Payments";

function parsePayment(raw: Record<string, unknown>): Payment {
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    type: (toStr(raw.type) || "payment") as Payment["type"],
    amount: toNum(raw.amount),
    paidAt: parseExcelDate(raw.paidAt as string | number) ?? new Date().toISOString(),
    method: (toStr(raw.method) || "cash") as Payment["method"],
    note: toStrOrNull(raw.note),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllPayments(): Payment[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parsePayment)
    .filter((p) => p.id && p.subscriptionId);
}

export function getPaymentsBySubscription(subscriptionId: string): Payment[] {
  return getAllPayments().filter((p) => p.subscriptionId === subscriptionId);
}

export function savePayments(payments: Payment[]): void {
  writeRows(FILE, SHEET, payments);
}

export function createPayment(data: Omit<Payment, "id" | "createdAt">): Payment {
  const payments = getAllPayments();
  const payment: Payment = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  payments.push(payment);
  savePayments(payments);
  return payment;
}

export function updatePayment(id: string, data: Partial<Omit<Payment, "id" | "subscriptionId" | "createdAt">>): void {
  savePayments(getAllPayments().map((p) => (p.id === id ? { ...p, ...data } : p)));
}

export function deletePayment(id: string): void {
  savePayments(getAllPayments().filter((p) => p.id !== id));
}

// ── Helpers are in lib/utils/payments (no Node.js deps, safe for client use) ──
