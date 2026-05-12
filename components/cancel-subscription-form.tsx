"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { suggestedRefund } from "@/lib/utils/subscription";
import type { MealSkip, Payment } from "@/lib/data/types";

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
  /** Called after successful cancellation so the parent can close/refresh */
  onDone: () => void;
  /** Called when user clicks "Keep" (cancel the cancel flow) */
  onCancel: () => void;
}

export function CancelSubscriptionForm({
  sub,
  customerId,
  skips,
  payments,
  onDone,
  onCancel,
}: CancelSubscriptionFormProps) {
  const refundCalc = suggestedRefund(sub, skips, payments);

  const [reason, setReason] = useState("");
  const [refundAmt, setRefundAmt] = useState(String(refundCalc.suggested));
  const [refundMethod, setRefundMethod] = useState<Payment["method"]>("cash");
  const [refundDate, setRefundDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [keepAsCredit, setKeepAsCredit] = useState(false);
  const [pending, startTransition] = useTransition();

  const parsedAmt = parseFloat(refundAmt) || 0;
  const exceedsNetPaid = parsedAmt > refundCalc.netPaid && refundCalc.netPaid > 0;

  function handleConfirm() {
    startTransition(async () => {
      await updateSubscriptionStatusAction(sub.id, "cancelled", reason.trim() || undefined);
      if (parsedAmt > 0) {
        if (keepAsCredit) {
          await addCreditAction({
            customerId,
            amount: parsedAmt,
            type: "refund_credit",
            note: note.trim() || "Cancellation refund kept as credit",
            subscriptionId: sub.id,
          });
        } else {
          await createPaymentAction({
            subscriptionId: sub.id,
            type: "refund",
            amount: parsedAmt,
            paidAt: refundDate,
            method: refundMethod,
            note: note.trim() || "Cancellation refund",
          });
        }
      }
      onDone();
    });
  }

  return (
    <div className="space-y-3">
      {/* Refund breakdown */}
      <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span>Price/day</span>
          <span>₫{refundCalc.pricePerDay.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Remaining days</span>
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
          <span>₫{refundCalc.proRataRefund.toLocaleString()}</span>
        </div>
        {refundCalc.isCapped && (
          <p className="text-amber-600 text-[10px] pt-1">
            Pro-rata is ₫{refundCalc.proRataRefund.toLocaleString()} but customer has only paid net ₫{refundCalc.netPaid.toLocaleString()}. Suggested capped.
          </p>
        )}
      </div>

      {/* Cancel reason */}
      <div className="space-y-1">
        <Label className="text-xs">Reason (optional)</Label>
        <Input
          className="text-xs h-7"
          placeholder="Why is this being cancelled?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {/* Refund amount */}
      <div className="space-y-1">
        <Label className="text-xs">Refund amount (₫)</Label>
        <Input
          type="number"
          min={0}
          step={1000}
          className="text-xs h-7"
          value={refundAmt}
          onChange={(e) => setRefundAmt(e.target.value)}
        />
        {exceedsNetPaid && (
          <p className="text-amber-600 text-[10px]">
            Warning: ₫{parsedAmt.toLocaleString()} exceeds net paid (₫{refundCalc.netPaid.toLocaleString()}).
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
          disabled={pending}
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

