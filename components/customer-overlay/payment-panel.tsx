"use client";

import { useState, useTransition } from "react";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { createPaymentAction, deletePaymentAction } from "@/app/actions/payments";
import { applyCreditToSubscriptionAction, revertCreditPaymentAction } from "@/app/actions/credits";
import type { Subscription, SubscriptionExtra, MealSkip, Payment, CreditTransaction } from "@/lib/data/types";
import { calculateProratedTotalDue, localDateStr } from "@/lib/utils/subscription";
import { paymentsTotalForSub, subscriptionPaymentStatus, subscriptionCompensation } from "@/lib/utils/payments";
import { PAYMENT_METHODS } from "@/lib/constants";
import { X } from "lucide-react";

function PaymentBadge({ status }: { status: "paid" | "partial" | "unpaid" }) {
  const cls =
    status === "paid"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
      : status === "partial"
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  return (
    <span className={`px-1 py-0.5 rounded-full text-[9px] shrink-0 ${cls}`}>
      {status}
    </span>
  );
}

export function PaymentPanel({
  sub,
  payments,
  extras,
  skips,
  creditTransactions,
  customerCredit = 0,
  customerId,
  onReload,
  onPaymentCreated,
  onPaymentDeleted,
}: {
  sub: Subscription;
  payments: Payment[];
  extras: SubscriptionExtra[];
  skips: MealSkip[];
  creditTransactions: CreditTransaction[];
  customerCredit?: number;
  customerId: string;
  onReload: () => void;
  onPaymentCreated?: (payment: Payment) => void;
  onPaymentDeleted?: (paymentId: string) => void;
}) {
  const subPayments = payments.filter((p) => p.subscriptionId === sub.id);
  const { paid, refunded } = paymentsTotalForSub(payments, sub.id);
  const compensation = subscriptionCompensation(sub.id, payments, creditTransactions);
  const subExtras = extras.filter((e) => e.subscriptionId === sub.id);
  const extrasTotal = subExtras.reduce((s, e) => s + e.amount, 0);
  const isCancelled = sub.status === "cancelled";
  const totalDue = isCancelled
    ? calculateProratedTotalDue(sub, skips, subExtras)
    : sub.subscriptionPrice + sub.shippingPrice - sub.discount + extrasTotal;
  const balance = totalDue - compensation.netEarned;
  const payStatusInfo = subscriptionPaymentStatus(sub, payments, extras, skips, creditTransactions);
  const payStatus = payStatusInfo.status;

  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [form, setForm] = useState<{
    type: Payment["type"];
    amount: string;
    paidAt: string;
    method: Payment["method"];
    note: string;
  }>({
    type: "payment",
    amount: balance > 0 ? String(balance) : "",
    paidAt: localDateStr(new Date()),
    method: "transfer",
    note: "",
  });
  const [showApplyCredit, setShowApplyCredit] = useState(false);
  const [creditApplyAmt, setCreditApplyAmt] = useState("");
  const [creditWarning, setCreditWarning] = useState<string | null>(null);

  const inp = "border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

  function handleRecord() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    startSave(async () => {
      const payment = await createPaymentAction({
        subscriptionId: sub.id,
        type: form.type,
        amount: amt,
        paidAt: form.paidAt,
        method: form.method,
        note: form.note.trim() || null,
      });
      setForm((p) => ({ ...p, amount: "", note: "" }));
      if (onPaymentCreated) onPaymentCreated(payment);
      else onReload();
    });
  }

  function handleDelete(id: string) {
    startSave(async () => {
      const paymentId = await deletePaymentAction(id);
      if (onPaymentDeleted) onPaymentDeleted(paymentId);
      else onReload();
    });
  }

  function handleApplyCredit() {
    const amt = parseFloat(creditApplyAmt);
    if (!amt || amt <= 0) return;
    startSave(async () => {
      const { warning } = await applyCreditToSubscriptionAction({
        customerId,
        subscriptionId: sub.id,
        amount: amt,
        note: "Credit applied",
      });
      setCreditWarning(warning);
      setShowApplyCredit(false);
      setCreditApplyAmt("");
      onReload();
    });
  }

  function handleRevertCredit(paymentId: string) {
    startSave(async () => {
      await revertCreditPaymentAction(paymentId, customerId);
      onReload();
    });
  }

  return (
    <div className="mt-0.5 border-t border-dashed pt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground w-full text-left"
      >
        <PaymentBadge status={payStatus} />
        <span className="ml-1">
          {compensation.netEarned !== 0
            ? `${compensation.netEarned.toLocaleString()} VND ${compensation.netEarned > 0 ? 'net' : 'refunded'}`
            : paid > 0 ? "Fully refunded" : "No payment"}
          {balance > 0
            ? isCancelled && payStatus === "paid"
              ? ` · ${balance.toLocaleString()} VND over-refunded`
              : ` · ${balance.toLocaleString()} VND due`
            : balance < 0
              ? isCancelled
                ? ` · ${Math.abs(balance).toLocaleString()} VND refund owed`
                : ` · ${Math.abs(balance).toLocaleString()} VND over`
              : " · ✓"}
        </span>
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-1 space-y-1.5">
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div className="bg-muted/30 rounded p-1">
              <p className="text-muted-foreground">Due</p>
              <p className="font-medium">{totalDue.toLocaleString()} VND</p>
            </div>
            <div className="bg-muted/30 rounded p-1">
              <p className="text-muted-foreground">Paid</p>
              <p className="font-medium text-green-700 dark:text-green-400">{paid.toLocaleString()} VND</p>
            </div>
            <div className="bg-muted/30 rounded p-1">
              <p className="text-muted-foreground">
                {isCancelled && balance < 0
                  ? "Refund owed"
                  : isCancelled && balance > 0
                    ? "Over-refunded"
                    : balance >= 0 ? "Balance" : "Overpaid"}
              </p>
              <p className={`font-medium ${balance > 0 ? "text-red-600" : balance < 0 ? "text-amber-600" : "text-green-700"}`}>
                {Math.abs(balance).toLocaleString()} VND
              </p>
            </div>
          </div>

          {subPayments.length > 0 && (
            <ul className="space-y-0.5">
              {subPayments.map((p) => (
                <li key={p.id} className="flex items-center gap-1 text-[10px] group">
                  <span className={p.type === "refund" ? "text-yellow-600" : "text-green-700"}>
                    {p.type === "refund" ? "-" : "+"}{p.amount.toLocaleString()} VND
                  </span>
                  {p.method === "credit" ? (
                    <span className="px-1 py-px rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[9px] font-medium">credit</span>
                  ) : (
                    <span className="text-muted-foreground">{p.method}</span>
                  )}
                  <span className="text-muted-foreground">{p.paidAt.slice(0, 10)}</span>
                  {p.note && p.method !== "credit" && <span className="text-muted-foreground truncate">{p.note}</span>}
                  {p.method === "credit" ? (
                    <button
                      type="button"
                      title="Undo credit payment"
                      onClick={() => handleRevertCredit(p.id)}
                      disabled={saving}
                      className="ml-auto h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-amber-600 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      ↩
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={saving}
                      className="ml-auto h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <X size={9} />
                    </button>
                  )}
                </li>
              ))}
              {refunded > 0 && (
                <li className="text-[10px] text-yellow-600">Refunded: {refunded.toLocaleString()} VND</li>
              )}
              {compensation.refundedToCredit > 0 && (
                <li className="text-[10px] text-emerald-600">→ Credit: {compensation.refundedToCredit.toLocaleString()} VND</li>
              )}
            </ul>
          )}

          {customerCredit > 0 && balance > 0 && (
            <div className="border-t border-dashed pt-1">
              {!showApplyCredit ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreditApplyAmt(String(Math.min(customerCredit, balance)));
                    setShowApplyCredit(true);
                  }}
                  className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  {customerCredit.toLocaleString()} VND credit available — Apply
                </button>
              ) : (
                <div className="flex items-center gap-1 flex-wrap">
                  <FormattedAmountInput
                    className={`${inp} w-24`}
                    placeholder="Amount"
                    value={creditApplyAmt}
                    onChange={(raw) => setCreditApplyAmt(raw)}
                  />
                  <button type="button" onClick={handleApplyCredit} disabled={saving || !creditApplyAmt}
                    className="px-2 py-0.5 text-[10px] rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                    Apply
                  </button>
                  <button type="button" onClick={() => { setShowApplyCredit(false); setCreditWarning(null); }}
                    className="px-2 py-0.5 text-[10px] rounded border hover:bg-accent">
                    Cancel
                  </button>
                  {creditWarning && <span className="text-amber-600 text-[10px]">{creditWarning}</span>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-1">
              <select className={inp} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Payment["type"] }))}>
                <option value="payment">Payment</option>
                <option value="refund">Refund</option>
              </select>
              <select className={inp} value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as Payment["method"] }))}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <FormattedAmountInput className={inp} placeholder="Amount" value={form.amount}
                onChange={(raw) => setForm((p) => ({ ...p, amount: raw }))} />
              <input className={inp} type="date" value={form.paidAt}
                onChange={(e) => setForm((p) => ({ ...p, paidAt: e.target.value }))} />
            </div>
            <div className="flex gap-1">
              <input className={`${inp} flex-1`} type="text" placeholder="Note (optional)" value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
              <button type="button" onClick={handleRecord} disabled={saving || !form.amount}
                className="px-2 py-0.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
