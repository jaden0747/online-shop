import type { Payment, Subscription, SubscriptionExtra, MealSkip } from "@/lib/data/types";
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

export function subscriptionPaymentStatus(
  sub: Subscription,
  payments: Payment[],
  extras: SubscriptionExtra[],
  skips?: MealSkip[]
): "paid" | "partial" | "unpaid" {
  const extrasTotal = extras.filter((e) => e.subscriptionId === sub.id).reduce((s, e) => s + e.amount, 0);
  const totalDue = sub.status === "cancelled" && skips
    ? calculateProratedTotalDue(sub, skips, extrasTotal)
    : sub.subscriptionPrice + sub.shippingPrice - sub.discount + extrasTotal;
  const { net, paid } = paymentsTotalForSub(payments, sub.id);
  const balance = totalDue - net;
  if (balance <= 1) return "paid"; // fully paid or overpaid (1₫ tolerance)
  if (net <= 0 && paid === 0) return "unpaid";
  return "partial";
}
