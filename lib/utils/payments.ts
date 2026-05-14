import type { Payment, Subscription, SubscriptionExtra, MealSkip, CreditTransaction } from "@/lib/data/types";
import { calculateProratedTotalDue } from "./subscription";

export function paymentsTotalForSub(
  payments: Payment[],
  subId: string
): { paid: number; refunded: number; net: number } {
  const subPayments = payments.filter((p) => p.subscriptionId === subId);
  const paid = subPayments.filter((p) => p.type === "payment").reduce((s, p) => s + p.amount, 0);
  const refunded = subPayments.filter((p) => p.type === "refund").reduce((s, p) => s + p.amount, 0);
  return { paid, refunded, net: paid - refunded };
}

export interface SubscriptionCompensation {
  paid: number;
  cashRefunded: number;
  refundedToCredit: number;
  totalCompensated: number;
  netEarned: number;
}

/**
 * Total amount the business has been "paid back" to the customer for a given sub,
 * across both cash refunds and refund-to-credit conversions linked to that sub.
 *
 * netEarned = paid − totalCompensated, i.e. the amount we keep after compensation.
 */
export function subscriptionCompensation(
  subId: string,
  payments: Payment[],
  credits: CreditTransaction[]
): SubscriptionCompensation {
  const paid = payments
    .filter((p) => p.subscriptionId === subId && p.type === "payment")
    .reduce((s, p) => s + p.amount, 0);
  const cashRefunded = payments
    .filter((p) => p.subscriptionId === subId && p.type === "refund")
    .reduce((s, p) => s + p.amount, 0);
  const refundedToCredit = credits
    .filter((t) => t.subscriptionId === subId && t.type === "refund_credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalCompensated = cashRefunded + refundedToCredit;
  return {
    paid,
    cashRefunded,
    refundedToCredit,
    totalCompensated,
    netEarned: paid - totalCompensated,
  };
}

export interface SubscriptionPaymentStatus {
  status: "paid" | "partial" | "unpaid";
  totalDue: number;
  netEarned: number;
  balance: number;             // totalDue − netEarned (positive = customer owes; negative = we owe / overpaid)
  residual: number;            // balance for cancelled subs (signed). 0 means fully settled.
  totalCompensated: number;
}

/**
 * Derives the per-subscription payment status using the compensation model.
 *
 * For cancelled subs:
 *   - totalDue is prorated to days actually used (via calculateProratedTotalDue).
 *   - compensation includes both cash refunds (Payment type=refund) and refund-to-credit
 *     conversions (CreditTransaction type=refund_credit, scoped to this sub).
 *   - Status is forced to "paid" once any compensation has been issued, OR balance is ≤1₫.
 *     The residual (signed balance) is returned so the UI can render a "₫X refund owed" /
 *     "₫X overpaid" footnote rather than flipping the badge to partial/yellow.
 *
 * For non-cancelled subs: 3-state behavior (paid / partial / unpaid) is preserved; credits
 * do not factor in because refund_credit only arises on cancellation.
 */
export function subscriptionPaymentStatus(
  sub: Subscription,
  payments: Payment[],
  extras: SubscriptionExtra[],
  skips?: MealSkip[],
  credits: CreditTransaction[] = []
): SubscriptionPaymentStatus {
  const extrasTotal = extras
    .filter((e) => e.subscriptionId === sub.id)
    .reduce((s, e) => s + e.amount, 0);
  const isCancelled = sub.status === "cancelled";
  const totalDue = isCancelled && skips
    ? calculateProratedTotalDue(sub, skips, extrasTotal)
    : sub.subscriptionPrice + sub.shippingPrice - sub.discount + extrasTotal;

  const { netEarned, totalCompensated, paid } = subscriptionCompensation(sub.id, payments, credits);
  const balance = totalDue - netEarned;

  let status: "paid" | "partial" | "unpaid";
  if (isCancelled) {
    // Once compensation has started OR balance is within tolerance, treat as settled.
    status = totalCompensated > 0 || balance <= 1 ? "paid" : paid > 0 ? "partial" : "unpaid";
  } else if (balance <= 1) {
    status = "paid";
  } else if (netEarned <= 0 && paid === 0) {
    status = "unpaid";
  } else {
    status = "partial";
  }

  return {
    status,
    totalDue,
    netEarned,
    balance,
    residual: isCancelled ? balance : 0,
    totalCompensated,
  };
}
