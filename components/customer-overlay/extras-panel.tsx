"use client";

import { useState, useTransition } from "react";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { createExtraAction, deleteExtraAction } from "@/app/actions/subscriptions";
import type { Subscription, SubscriptionExtra } from "@/lib/data/types";
import { localDateStr, countWorkingDays } from "@/lib/utils/subscription";
import { X } from "lucide-react";

export function ExtrasPanel({
  sub,
  extras,
  onReload,
}: {
  sub: Subscription;
  extras: SubscriptionExtra[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [noteInput, setNoteInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");

  const subEndDate = localDateStr(sub.endDate);
  const total = extras.reduce((s, e) => s + e.amount, 0);
  const inp = "border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

  function handleAdd() {
    const amount = parseFloat(amountInput);
    if (!amount) return;
    startSave(async () => {
      const fd = new FormData();
      fd.set("subscriptionId", sub.id);
      fd.set("amount", String(amount));
      fd.set("note", noteInput.trim());
      if (startDateInput) {
        fd.set("startDate", startDateInput);
        fd.set("endDate", endDateInput || startDateInput);
      }
      await createExtraAction(fd);
      setNoteInput("");
      setAmountInput("");
      setStartDateInput("");
      setEndDateInput("");
      onReload();
    });
  }

  function handleDelete(id: string) {
    startSave(async () => {
      await deleteExtraAction(id);
      onReload();
    });
  }

  return (
    <div className="mt-0.5 border-t border-dashed pt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground w-full text-left"
      >
        <span className="font-medium">Extras / Addons</span>
        {total > 0 && (
          <span className="text-amber-600 font-medium">+{total.toLocaleString()} VND</span>
        )}
        <span className="ml-auto">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-1 space-y-1">
          {extras.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/50">No extras yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {extras.map((e) => {
                const hasPeriod = e.startDate && e.endDate;
                let periodLabel = "";
                let perDayLabel = "";
                if (hasPeriod) {
                  const start = localDateStr(e.startDate!);
                  const end = localDateStr(e.endDate!);
                  periodLabel = start === end ? start : `${start} – ${end}`;
                  const startD = new Date(start + "T00:00:00");
                  const endD = new Date(end + "T00:00:00");
                  const days = Math.max(1, countWorkingDays(startD, new Date(endD.getTime() + 86_400_000)));
                  if (days > 1) perDayLabel = `${Math.round(e.amount / days).toLocaleString()} VND/day`;
                }
                return (
                  <li key={e.id} className="flex items-start gap-1 text-[10px] group">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-amber-600">+{e.amount.toLocaleString()} VND</span>
                      {perDayLabel && <span className="text-muted-foreground ml-1">({perDayLabel})</span>}
                      {periodLabel && <span className="text-muted-foreground ml-1">{periodLabel}</span>}
                      {e.note && <span className="text-muted-foreground ml-1 truncate">{e.note}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      disabled={saving}
                      className="h-4 w-4 flex-shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <X size={9} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-1 pt-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <input
                className={`${inp} flex-1 min-w-[80px]`}
                type="text"
                placeholder="Note (e.g. extra protein)"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />
              <FormattedAmountInput
                className={`${inp} w-20`}
                placeholder="₫ Amount"
                value={amountInput}
                onChange={(raw) => setAmountInput(raw)}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-10">Start</span>
              <input
                className={`${inp} flex-1`}
                type="date"
                title="Period start date"
                value={startDateInput}
                max={subEndDate}
                onChange={(e) => {
                  setStartDateInput(e.target.value);
                  if (!endDateInput || endDateInput < e.target.value) setEndDateInput(e.target.value);
                }}
              />
              <span className="text-[10px] text-muted-foreground w-6 text-center">–</span>
              <input
                className={`${inp} flex-1`}
                type="date"
                title="Period end date (cannot exceed subscription end)"
                value={endDateInput}
                min={startDateInput}
                max={subEndDate}
                onChange={(e) => setEndDateInput(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !amountInput}
                className="px-2 py-0.5 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {startDateInput && endDateInput && startDateInput !== endDateInput && (() => {
              const s = new Date(startDateInput + "T00:00:00");
              const e = new Date(endDateInput + "T00:00:00");
              const days = countWorkingDays(s, new Date(e.getTime() + 86_400_000));
              const amt = parseFloat(amountInput) || 0;
              return days > 0 && amt > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  {days} working days · {Math.round(amt / days).toLocaleString()} VND/day
                </p>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
