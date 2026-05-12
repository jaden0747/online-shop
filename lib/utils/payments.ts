import type { Payment, Subscription, SubscriptionExtra } from "@/lib/data/types";

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
  extras: SubscriptionExtra[]
): "paid" | "partial" | "unpaid" {
  const totalDue =
    sub.subscriptionPrice +
    sub.shippingPrice -
    sub.discount +
    extras.filter((e) => e.subscriptionId === sub.id).reduce((s, e) => s + e.amount, 0);
  const { net } = paymentsTotalForSub(payments, sub.id);
  if (net <= 0) return "unpaid";
  if (net >= totalDue - 1) return "paid"; // 1₫ tolerance for rounding
  return "partial";
}
