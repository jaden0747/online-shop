import type { Details } from "./types";
import { earnedRevenueAsOf } from "@/lib/utils/revenue";
import { calculateProratedTotalDue } from "@/lib/utils/subscription";
import { subscriptionCompensation } from "@/lib/utils/payments";

export function FinancialSummary({ details }: { details: Details }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalEarned = details.subscriptions.reduce(
    (s, sub) => s + earnedRevenueAsOf(sub, details.skips, details.extras, today),
    0
  );
  const totalCollected = details.payments
    .filter((p) => p.type === "payment")
    .reduce((s, p) => s + p.amount, 0);
  const totalRefundCash = details.payments
    .filter((p) => p.type === "refund")
    .reduce((s, p) => s + p.amount, 0);
  const totalRefundCredit = details.creditTransactions
    .filter((t) => t.type === "refund_credit")
    .reduce((s, t) => s + t.amount, 0);
  const netCollected = totalCollected - totalRefundCash - totalRefundCredit;

  const totalBalance = details.subscriptions.reduce((s, sub) => {
    const subExtras = details.extras.filter((e) => e.subscriptionId === sub.id);
    const extrasTotal = subExtras.reduce((a, e) => a + e.amount, 0);
    const isCancelled = sub.status === "cancelled";
    const totalDue = isCancelled
      ? calculateProratedTotalDue(
          sub,
          details.skips.filter((sk) => sk.subscriptionId === sub.id),
          subExtras
        )
      : sub.subscriptionPrice + sub.shippingPrice - sub.discount + extrasTotal;
    const comp = subscriptionCompensation(sub.id, details.payments, details.creditTransactions);
    return s + (totalDue - comp.netEarned);
  }, 0);

  return (
    <div className="grid grid-cols-3 gap-2 text-[11px] bg-muted/30 rounded-lg p-2.5">
      <div>
        <p className="text-[10px] text-muted-foreground">Recognized Revenue</p>
        <p className="font-semibold">{totalEarned.toLocaleString()} VND</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">Net Collected</p>
        <p className="font-semibold">{netCollected.toLocaleString()} VND</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">
          {totalBalance > 0 ? "Balance Due" : totalBalance < 0 ? "Refund Owed" : "Balance"}
        </p>
        <p
          className={`font-semibold ${
            totalBalance > 0
              ? "text-red-600"
              : totalBalance < 0
              ? "text-amber-600"
              : "text-green-600"
          }`}
        >
          {totalBalance === 0 ? "✓ Clear" : `${Math.abs(totalBalance).toLocaleString()} VND`}
        </p>
      </div>
    </div>
  );
}
