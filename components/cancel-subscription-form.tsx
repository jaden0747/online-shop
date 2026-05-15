"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSubscriptionStatusAction } from "@/app/actions/subscriptions";
import { createPaymentAction } from "@/app/actions/payments";
import { addCreditAction } from "@/app/actions/credits";
import { suggestedRefund, todayDateStr, localDateStr } from "@/lib/utils/subscription";
import type { CreditTransaction, MealSkip, Payment, Subscription, SubscriptionExtra } from "@/lib/data/types";

type Sub = {
  id: string;
  plan: string;
  subscriptionPrice: number;
  shippingPrice: number;
  discount: number;
  endDate: string;
};

interface CancelSubscriptionFormProps {
  sub: Sub;
  customerId: string;
  skips: MealSkip[];
  payments: Payment[];
  extras: SubscriptionExtra[];
  /** Called after successful cancellation so the parent can close/refresh */
  onDone: (result?: {
    subscription: Subscription | null;
    payment?: Payment;
    creditTransaction?: CreditTransaction;
  }) => void;
  /** Called when user clicks "Keep" (cancel the cancel flow) */
  onCancel: () => void;
}

export function CancelSubscriptionForm({
  sub,
  customerId,
  skips,
  payments,
  extras,
  onDone,
  onCancel,
}: CancelSubscriptionFormProps) {
  const [cancelDate, setCancelDate] = useState(todayDateStr());
  const [reasonPreset, setReasonPreset] = useState<string>("");
  const [reasonCustom, setReasonCustom] = useState("");
  const [refundMethod, setRefundMethod] = useState<Payment["method"]>("transfer");
  const [refundDate, setRefundDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  const [keepAsCredit, setKeepAsCredit] = useState(false);
  const [pending, startTransition] = useTransition();

  // Re-derive the refund calculation live as the cancellation date changes.
  const refundCalc = useMemo(() => {
    const asOf = new Date(cancelDate + "T00:00:00");
    return suggestedRefund(sub, skips, payments, asOf, extras);
  }, [sub, skips, payments, extras, cancelDate]);

  const [refundAmt, setRefundAmt] = useState(String(refundCalc.suggested));

  // Sync the refund amount when the calc changes (e.g. date changes), but only if
  // the user hasn't manually edited it away from the suggested value.
  const suggestedStr = String(refundCalc.suggested);

  const parsedAmt = parseFloat(refundAmt) || 0;
  const exceedsNetPaid = parsedAmt > refundCalc.netPaid && refundCalc.netPaid > 0;

  const endDateStr = localDateStr(sub.endDate);
  const cancelDateObj = new Date(cancelDate + "T00:00:00");
  const endDateObj = new Date(endDateStr + "T00:00:00");

  const REASON_PRESETS = [
    { value: "personal_preference", label: "Personal preference" },
    { value: "store_mistake", label: "Store mistake" },
    { value: "others", label: "Others (fill in)" },
  ];
  const effectiveReason =
    reasonPreset === "others"
      ? reasonCustom.trim()
      : reasonPreset
        ? REASON_PRESETS.find((r) => r.value === reasonPreset)?.label ?? ""
        : "";

  function handleConfirm() {
    startTransition(async () => {
      const subscription = await updateSubscriptionStatusAction(
        sub.id,
        "cancelled",
        effectiveReason || undefined,
        cancelDate + "T00:00:00.000Z"
      );
      let payment: Payment | undefined;
      let creditTransaction: CreditTransaction | undefined;
      if (parsedAmt > 0) {
        if (keepAsCredit) {
          creditTransaction = await addCreditAction({
            customerId,
            amount: parsedAmt,
            type: "refund_credit",
            note: note.trim() || "Cancellation refund kept as credit",
            subscriptionId: sub.id,
          });
        } else {
          payment = await createPaymentAction({
            subscriptionId: sub.id,
            type: "refund",
            amount: parsedAmt,
            paidAt: refundDate,
            method: refundMethod,
            note: note.trim() || "Cancellation refund",
          });
        }
      }
      onDone({ subscription, payment, creditTransaction });
    });
  }

  return (
    <div className="space-y-3">
      {/* Cancellation date */}
      <div className="space-y-1">
        <Label className="text-xs">Cancellation date</Label>
        <Input
          type="date"
          className="h-7 text-xs"
          value={cancelDate}
          max={endDateStr}
          onChange={(e) => {
            setCancelDate(e.target.value);
            // Snap refund amount to new suggested when user hasn't diverged
            const asOf = new Date(e.target.value + "T00:00:00");
            const next = suggestedRefund(sub, skips, payments, asOf, extras);
            setRefundAmt(String(next.suggested));
          }}
        />
        <p className="text-[10px] text-muted-foreground">
          Set to <strong>tomorrow</strong> if today&apos;s meal was already served — refund days start from this date.
        </p>
      </div>

      {/* Refund breakdown */}
      <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span>Price/day</span>
          <span>{refundCalc.pricePerDay.toLocaleString()} VND</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Remaining days (from {cancelDate})</span>
          <span>{refundCalc.remainingDays}</span>
        </div>
        {refundCalc.futureSkipsNoReplace > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>− Future skips (no replace)</span>
            <span>{refundCalc.futureSkipsNoReplace}</span>
          </div>
        )}
        {refundCalc.pastSkipsNoReplace > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>+ Past skips (no replace)</span>
            <span>{refundCalc.pastSkipsNoReplace}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground border-t pt-1">
          <span>Refund days</span>
          <span>{refundCalc.refundDays}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Pro-rata refund</span>
          <span>{refundCalc.proRataRefund.toLocaleString()} VND</span>
        </div>
        {refundCalc.extrasRefund > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>+ Extras refund</span>
            <span>{refundCalc.extrasRefund.toLocaleString()} VND</span>
          </div>
        )}
        {refundCalc.isCapped && (
          <p className="text-amber-600 text-[10px] pt-1">
            Pro-rata is {refundCalc.proRataRefund.toLocaleString()} VND but customer has only paid net {refundCalc.netPaid.toLocaleString()} VND. Suggested capped.
          </p>
        )}
      </div>

      {/* Cancel reason */}
      <div className="space-y-1">
        <Label className="text-xs">Reason (optional)</Label>
        <Select value={reasonPreset} onValueChange={(v) => setReasonPreset(v ?? "")}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select a reason…" />
          </SelectTrigger>
          <SelectContent>
            {REASON_PRESETS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reasonPreset === "others" && (
          <Input
            className="text-xs h-7 mt-1"
            placeholder="Describe the reason…"
            value={reasonCustom}
            onChange={(e) => setReasonCustom(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {/* Refund amount */}
      <div className="space-y-1">
        <Label className="text-xs">
          Refund amount (₫)
          {refundAmt !== suggestedStr && (
            <button
              type="button"
              className="ml-2 text-[10px] text-primary hover:underline"
              onClick={() => setRefundAmt(suggestedStr)}
            >
              reset to suggested
            </button>
          )}
        </Label>
        <FormattedAmountInput
          className="text-xs h-7"
          value={refundAmt}
          onChange={(raw) => setRefundAmt(raw)}
        />
        {exceedsNetPaid && (
          <p className="text-amber-600 text-[10px]">
            Warning: {parsedAmt.toLocaleString()} VND exceeds net paid ({refundCalc.netPaid.toLocaleString()} VND).
          </p>
        )}
      </div>

      {/* Keep as credit toggle */}
      {parsedAmt > 0 && (
        <div className="flex items-center gap-2">
          <input
            id="keep-as-credit"
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-input accent-primary"
            checked={keepAsCredit}
            onChange={(e) => setKeepAsCredit(e.target.checked)}
          />
          <Label htmlFor="keep-as-credit" className="text-xs cursor-pointer">
            Convert refund to credit (instead of paying out)
          </Label>
        </div>
      )}

      {/* Refund method + date — only shown when refund > 0 and NOT keeping as credit */}
      {parsedAmt > 0 && !keepAsCredit && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Method</Label>
            <Select
              value={refundMethod}
              onValueChange={(v) => setRefundMethod(v as Payment["method"])}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="momo">MoMo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              className="h-7 text-xs"
              value={refundDate}
              onChange={(e) => setRefundDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Note */}
      <div className="space-y-1">
        <Label className="text-xs">Note (optional)</Label>
        <Input
          className="text-xs h-7"
          placeholder={keepAsCredit ? "Note for credit entry" : "Note for this refund"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          disabled={pending || cancelDateObj > endDateObj}
          onClick={handleConfirm}
        >
          {pending ? "Cancelling…" : "Confirm Cancel"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onCancel}
        >
          Keep
        </Button>
      </div>
    </div>
  );
}
