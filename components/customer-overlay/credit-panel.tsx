"use client";

import { useState, useTransition } from "react";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { addCreditAction, deleteCreditTransactionAction } from "@/app/actions/credits";
import type { CreditTransaction, Subscription } from "@/lib/data/types";
import { creditBalance } from "@/lib/utils/credits";
import { Plus, Check, X } from "lucide-react";

const TYPE_LABELS: Record<CreditTransaction["type"], string> = {
  refund_credit: "Refund → Credit",
  manual_topup: "Manual top-up",
  credit_used: "Used",
  adjustment: "Adjustment",
};

export function CreditPanel({
  customerId,
  creditTransactions,
  subscriptions,
  onReload,
}: {
  customerId: string;
  creditTransactions: CreditTransaction[];
  subscriptions: Subscription[];
  onReload: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  const balance = creditBalance(creditTransactions);

  const sorted = [...creditTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function handleAdd() {
    const amount = parseFloat(addAmount);
    if (!amount || amount <= 0) return;
    startTransition(async () => {
      await addCreditAction({ customerId, amount, type: "manual_topup", note: addNote.trim() || "Manual credit" });
      setAddAmount("");
      setAddNote("");
      setShowAddForm(false);
      onReload();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const { warning } = await deleteCreditTransactionAction(id, customerId);
      if (warning) setDeleteWarning(warning);
      else setDeleteWarning(null);
      onReload();
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Credit Balance</p>
        {!showAddForm && (
          <button type="button" onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={11} /> Add
          </button>
        )}
      </div>

      <div className={[
        "rounded-lg p-2.5 text-center",
        balance > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-muted/40",
      ].join(" ")}>
        <p className={["text-lg font-bold", balance > 0 ? "text-emerald-600" : "text-muted-foreground"].join(" ")}>
          {balance.toLocaleString()} VND
        </p>
        <p className="text-[10px] text-muted-foreground">available credit</p>
      </div>

      {deleteWarning && (
        <p className="text-amber-600 text-[10px] bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">{deleteWarning}</p>
      )}

      {showAddForm && (
        <div className="border rounded-lg p-2 space-y-1">
          <FormattedAmountInput
            placeholder="Amount (₫)"
            className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
            value={addAmount}
            onChange={(raw) => setAddAmount(raw)}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
          />
          <div className="flex gap-1.5 pt-0.5">
            <button type="button" onClick={handleAdd} disabled={isPending || !addAmount}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Check size={10} /> Add
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setAddAmount(""); setAddNote(""); }}
              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border hover:bg-accent">
              <X size={10} /> Cancel
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground/50">No credit transactions.</p>
      ) : (
        <ul className="space-y-0.5 max-h-[140px] overflow-y-auto pr-1">
          {sorted.map((tx) => (
            <li key={tx.id} className="flex items-start justify-between gap-1 text-[11px] group">
              <div className="min-w-0">
                <span className={[
                  "font-medium",
                  tx.type === "credit_used" ? "text-red-600" : "text-emerald-600",
                ].join(" ")}>
                  {tx.type === "credit_used" ? "-" : "+"}{tx.amount.toLocaleString()} VND
                </span>
                <span className="text-muted-foreground ml-1">{TYPE_LABELS[tx.type]}</span>
                {tx.note && <span className="text-muted-foreground/60 ml-1">· {tx.note}</span>}
                <span className="text-muted-foreground/40 ml-1">
                  {new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(tx.id)}
                disabled={isPending}
                className="h-4 w-4 shrink-0 flex items-center justify-center rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-opacity"
              >
                <X size={9} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
