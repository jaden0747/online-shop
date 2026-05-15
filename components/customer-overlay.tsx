"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import {
  getCustomerDetailsAction,
  updateCustomerNoteAction,
  updateCustomerInfoAction,
  addAddressAction,
  updateAddressFieldsAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/app/actions/customers";
import { updateAddressCoordsStringAction } from "@/app/actions/addresses";
import {
  updateSubscriptionStatusAction,
  createSubscriptionAction,
  updateSubscriptionAction,
  deleteSubscriptionAction,
  createExtraAction,
  deleteExtraAction,
} from "@/app/actions/subscriptions";
import { skipDayAndExtendAction, unskipDayAndShortenAction } from "@/app/actions/skips";
import { upsertSelectionDirectAction, deleteSelectionDirectAction } from "@/app/actions/selections";
import { upsertKitchenNoteAction } from "@/app/actions/notes";
import { upsertDayAddressAction, deleteDayAddressAction } from "@/app/actions/order-day-addresses";
import { createPaymentAction, deletePaymentAction } from "@/app/actions/payments";
import { addCreditAction, useCreditAction, deleteCreditTransactionAction, applyCreditToSubscriptionAction, revertCreditPaymentAction } from "@/app/actions/credits";
import dynamic from "next/dynamic";
const CustomerMinimap = dynamic(
  () => import("./customer-minimap").then((m) => m.CustomerMinimap),
  { ssr: false }
);
import type { Customer, CustomerAddress, Subscription, SubscriptionExtra, Pricing, MealSkip, MealSelection, MenuItem, KitchenNote, OrderDayAddress, Payment, CreditTransaction } from "@/lib/data/types";
import { subscriptionStatus, daysRemaining, planTotalMeals, addWorkingDays, isSubscriptionLive, calculateProratedTotalDue, countWorkingDays } from "@/lib/utils/subscription";
import { subscriptionPaymentStatus, paymentsTotalForSub, subscriptionCompensation } from "@/lib/utils/payments";
import { earnedRevenueAsOf } from "@/lib/utils/revenue";
import { weekLabelForDate } from "@/lib/utils/week";
import { CancelSubscriptionForm } from "./cancel-subscription-form";
import { Pencil, X, Plus, Star, Trash2, Check, MapPin, ChevronLeft, ChevronRight, Copy } from "lucide-react";

type Details = {
  customer: Customer | null;
  addresses: CustomerAddress[];
  subscriptions: Subscription[];
  skipCounts: Record<string, number>;
  totalSpend: number;
  pricing: Pricing[];
  skips: MealSkip[];
  allSelections: MealSelection[];
  allMenuItems: MenuItem[];
  kitchenNotes: KitchenNote[];
  dayAddresses: OrderDayAddress[];
  hub: { lat: number; lng: number };
  mealPrices: Record<string, number>;
  payments: Payment[];
  extras: SubscriptionExtra[];
  creditTransactions: CreditTransaction[];
};

// ── CreditPanel ──────────────────────────────────────────────────────────────
function CreditPanel({
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

  const balance = creditTransactions.reduce((acc, t) => {
    if (t.type === "refund_credit" || t.type === "manual_topup" || t.type === "adjustment") return acc + t.amount;
    if (t.type === "credit_used") return acc - t.amount;
    return acc;
  }, 0);

  const sorted = [...creditTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const TYPE_LABELS: Record<CreditTransaction["type"], string> = {
    refund_credit: "Refund → Credit",
    manual_topup: "Manual top-up",
    credit_used: "Used",
    adjustment: "Adjustment",
  };

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

      {/* Balance display */}
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

      {/* Add credit form */}
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

      {/* Transaction history */}
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

// ── CoordsEditor ────────────────────────────────────────────────────────────
function CoordsEditor({
  addressId,
  customerId,
  lat,
  lng,
  onSaved,
}: {
  addressId: string;
  customerId: string;
  lat: number | null;
  lng: number | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lat != null && lng != null ? `${lat}, ${lng}` : "");
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      await updateAddressCoordsStringAction(addressId, customerId, value.trim());
      setEditing(false);
      onSaved();
    });
  }

  if (!editing) {
    const hasCoords = lat != null && lng != null;
    return (
      <button
        type="button"
        onClick={() => { setValue(lat != null && lng != null ? `${lat}, ${lng}` : ""); setEditing(true); }}
        className={[
          "flex items-center gap-1 text-xs mt-0.5",
          hasCoords
            ? "text-emerald-600 hover:text-emerald-700"
            : "text-amber-500 hover:text-amber-600",
        ].join(" ")}
      >
        <MapPin size={10} />
        {hasCoords ? `${lat?.toFixed(5)}, ${lng?.toFixed(5)}` : "Add coords"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <input
        autoFocus
        className="flex-1 text-xs bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="lat, lng"
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-5 w-5 flex items-center justify-center rounded text-emerald-600 hover:bg-accent disabled:opacity-50"
      >
        <Check size={10} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <X size={10} />
      </button>
    </div>
  );
}

// ── SubForm (create + edit) ──────────────────────────────────────────────────
const GOALS = ["cutting", "maintenance", "bulking", "keto"];
const PLANS = ["trial", "weekly", "monthly"];

function SubForm({
  mode,
  subId,
  customerId,
  pricing,
  mealPrices = {},
  initial,
  skips = [],
  creditBalance: customerCreditBalance = 0,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  subId?: string;
  customerId: string;
  pricing: Pricing[];
  mealPrices?: Record<string, number>;
  initial?: Subscription;
  skips?: MealSkip[];
  creditBalance?: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState(initial?.plan ?? "weekly");
  const [goal, setGoal] = useState(initial?.goal ?? "cutting");
  const [meals, setMeals] = useState(initial?.mealsPerDay ?? 2);
  const [trialDays, setTrialDays] = useState(initial?.trialDays ?? 3);
  const [startDate, setStartDate] = useState(
    initial?.startDate ? localDateStr(new Date(initial.startDate)) : localDateStr(new Date())
  );
  const [endDate, setEndDate] = useState(
    initial?.endDate ? localDateStr(new Date(initial.endDate)) : ""
  );
  const [endDateNoSkip, setEndDateNoSkip] = useState(
    initial?.endDateNoSkip ? localDateStr(new Date(initial.endDateNoSkip)) : ""
  );
  const [subPrice, setSubPrice] = useState(initial ? String(initial.subscriptionPrice) : "");
  const [shipPrice, setShipPrice] = useState(initial ? String(initial.shippingPrice) : "");
  const [discount, setDiscount] = useState(initial ? String(initial.discount ?? 0) : "0");
  const [autoRenewal, setAutoRenewal] = useState(mode === "create");

  // Credit application (create mode only)
  const [applyCredit, setApplyCredit] = useState(false);
  const [creditApplyAmt, setCreditApplyAmt] = useState("");

  const [saving, startSave] = useTransition();

  // Auto-fill price from pricing table (create mode only, or when plan/goal/meals change in edit)
  const didMount = useRef(false);
  useEffect(() => {
    if (mode === "edit" && !didMount.current) { didMount.current = true; return; }
    didMount.current = true;
    if (plan === "trial" && (mealPrices[goal] ?? 0) > 0) {
      setSubPrice(String((mealPrices[goal] ?? 0) * (trialDays ?? 3) * meals));
    } else {
      const match = pricing.find((p) => p.plan === plan && p.goal === goal && p.mealsPerDay === meals);
      if (match && mode === "create") setSubPrice(String(match.totalPrice));
    }
  }, [plan, goal, meals, pricing, mode, mealPrices, trialDays]);

  // Auto-compute end date when plan/startDate/trialDays/skips change (only if auto mode)
  useEffect(() => {
    if (!autoRenewal) return;
    try {
      const start = new Date(startDate);
      const days = plan === "weekly" ? 4 : plan === "monthly" ? 19 : ((trialDays ?? 3) - 1);
      const newBase = addWorkingDays(start, days);
      setEndDateNoSkip(localDateStr(newBase));
      setEndDate(localDateStr(addWorkingDays(newBase, skips.length)));
    } catch { /* ignore */ }
  }, [plan, startDate, trialDays, autoRenewal, skips.length]);

  function submit() {
    if (mode === "create") {
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("plan", plan);
      fd.set("goal", goal);
      fd.set("mealsPerDay", String(meals));
      fd.set("subscriptionPrice", subPrice);
      fd.set("shippingPrice", shipPrice || "0");
      fd.set("discount", discount || "0");
      fd.set("startDate", startDate);
      if (!autoRenewal && endDate) fd.set("endDate", endDate);
      if (plan === "trial") fd.set("trialDays", String(trialDays));
      startSave(async () => {
        const { id: newSubId } = await createSubscriptionAction(fd);
        if (applyCredit) {
          const creditAmt = parseFloat(creditApplyAmt) || 0;
          if (creditAmt > 0) {
            await applyCreditToSubscriptionAction({
              customerId,
              subscriptionId: newSubId,
              amount: creditAmt,
              note: "Credit applied at subscription creation",
            });
          }
        }
        onSaved();
      });
    } else {
      if (!subId) return;
      // If user manually set endDate (no auto), treat it as the new base (no skip extensions)
      const submitEndDateNoSkip = autoRenewal ? endDateNoSkip : endDate;
      startSave(async () => {
        await updateSubscriptionAction(subId, {
          plan, goal, mealsPerDay: meals,
          subscriptionPrice: parseFloat(subPrice) || 0,
          shippingPrice: parseFloat(shipPrice) || 0,
          discount: parseFloat(discount) || 0,
          trialDays: plan === "trial" ? trialDays : null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          endDateNoSkip: new Date(submitEndDateNoSkip || endDate),
          addressId: null,
        });
        onSaved();
      });
    }
  }

const totalMeals = planTotalMeals(plan) * meals;
const totalPrice = (parseFloat(subPrice) || 0) + (parseFloat(shipPrice) || 0) - (parseFloat(discount) || 0);
const sel = "w-full border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";
const inp = "w-full border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

// Sync default credit amount when totalPrice or credit balance changes
// (only when checkbox is first checked)
const defaultCreditAmt = String(Math.min(customerCreditBalance, Math.max(0, totalPrice)));

  return (
    <div className="border rounded-lg p-2 space-y-1 bg-muted/20 text-xs">
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Plan</span>
          <select className={sel} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Goal</span>
          <select className={sel} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Meals</span>
          <select className={sel} value={meals} onChange={(e) => setMeals(Number(e.target.value))}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {plan === "trial" && (
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Trial days</span>
          <input className={inp} type="number" min={1} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
        </label>
      )}
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Sub</span>
          <FormattedAmountInput className={inp} placeholder="0" value={subPrice} onChange={(raw) => setSubPrice(raw)} />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Ship</span>
          <FormattedAmountInput className={inp} placeholder="0" value={shipPrice} onChange={(raw) => setShipPrice(raw)} />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Disc</span>
          <FormattedAmountInput className={inp} placeholder="0" value={discount} onChange={(raw) => setDiscount(raw)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Start</span>
          <input className={inp} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">End</span>
          <input className={inp} type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setAutoRenewal(false); }} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={autoRenewal} onChange={(e) => setAutoRenewal(e.target.checked)} className="h-3 w-3" />
          <span className="text-[10px] text-muted-foreground">Auto end date</span>
        </label>
      </div>
      {/* Inline credit step — create mode only, when customer has credit */}
      {mode === "create" && customerCreditBalance > 0 && (
        <div className="border-t pt-1 space-y-0.5">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="h-3 w-3 accent-emerald-600"
              checked={applyCredit}
              onChange={(e) => {
                setApplyCredit(e.target.checked);
                if (e.target.checked && !creditApplyAmt) setCreditApplyAmt(defaultCreditAmt);
              }}
            />
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
              Apply credit ({customerCreditBalance.toLocaleString()} VND available)
            </span>
          </label>
          {applyCredit && (
            <div className="flex items-center gap-1 pl-4">
              <span className="text-[10px] text-muted-foreground shrink-0">Amount</span>
              <FormattedAmountInput
                className={inp + " max-w-[100px]"}
                value={creditApplyAmt}
                onChange={(raw) => setCreditApplyAmt(raw)}
              />
              {parseFloat(creditApplyAmt) > customerCreditBalance && (
                <span className="text-amber-600 text-[10px]">exceeds balance</span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {totalMeals} meals · {totalPrice.toLocaleString()} VND
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={submit} disabled={saving || !subPrice}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Check size={10} /> {mode === "create" ? "Create" : "Save"}
          </button>
          <button type="button" onClick={onCancel}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded border hover:bg-accent">
            <X size={10} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function localDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// ── ExtrasPanel ──────────────────────────────────────────────────────────────
function ExtrasPanel({
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

  const subEndDate = localDateStr(sub.endDate); // max allowed for endDate
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
          {/* Existing extras */}
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

          {/* Add extra form */}
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
                  // Auto-set end to start if end is before new start
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

// ── PaymentPanel ─────────────────────────────────────────────────────────────
const PAYMENT_METHODS: Payment["method"][] = ["cash", "transfer", "momo", "other"];

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

function PaymentPanel({
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

  const inp = "border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

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
          {/* Summary */}
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

          {/* Payment history */}
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

          {/* Apply Credit section */}
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

          {/* Record form */}
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

function getRouteInfo(
  routes: Map<string, { positions: [number, number][]; distance: number; duration: number }>,
  loadingRoutes: boolean,
  addrId: string
): React.ReactNode {
  const route = routes.get(addrId);
  if (route) {
    return (
      <span className="text-[10px] text-emerald-600">
        {(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} min
      </span>
    );
  }
  if (loadingRoutes) {
    return <span className="text-[10px] text-muted-foreground/40">Loading route...</span>;
  }
  return null;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// ── SchedulePanel ────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HDR = ["M","T","W","T","F","S","S"];

const SchedulePanel = memo(function SchedulePanel({
  subscriptions,
  addresses,
  skips,
  allSelections,
  allMenuItems,
  kitchenNotes,
  dayAddresses,
  customerId,
  onReload,
  minimap,
}: {
  subscriptions: Subscription[];
  addresses: CustomerAddress[];
  skips: MealSkip[];
  allSelections: MealSelection[];
  allMenuItems: MenuItem[];
  kitchenNotes: KitchenNote[];
  dayAddresses: OrderDayAddress[];
  customerId: string;
  onReload: () => void;
  minimap?: React.ReactNode;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const todayStr = localDateStr(now);
  const maxDateStr = localDateStr(addWorkingDays(now, 30));

  const calDays = useMemo(() => {
    const days: (string | null)[] = [];
    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const startCol = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < startCol; i++) days.push(null);
    const total = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= total; d++) days.push(localDateStr(new Date(year, month, d)));
    return days;
  }, [year, month]);

  const skippedSet = useMemo(() => new Set(skips.map((s) => localDateStr(new Date(s.originalDay)))), [skips]);
  const replacementSet = useMemo(() => new Set(skips.filter((s) => s.replacementDay).map((s) => localDateStr(new Date(s.replacementDay!)))), [skips]);

  const isLiveOrUpcomingOnDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return subscriptions.some((s) => {
      if (s.status === "cancelled") return false;
      const status = subscriptionStatus(s.status, s.startDate, s.endDate);
      if (status === "active") return isSubscriptionLive(s.status, s.startDate, s.endDate, d);
      if (status === "upcoming") {
        const start = new Date(s.startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
        const dMid = new Date(d); dMid.setHours(0, 0, 0, 0);
        return dMid >= start && dMid <= end;
      }
      if (status === "expired") {
        const start = new Date(s.startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
        const dMid = new Date(d); dMid.setHours(0, 0, 0, 0);
        return dMid >= start && dMid <= end;
      }
      return false;
    });
  }, [subscriptions]);

  const isActiveOnDate = isLiveOrUpcomingOnDate;

  const selectedActiveSub = useMemo(() => {
    if (!selectedDateStr) return null;
    const d = new Date(selectedDateStr + "T12:00:00");
    // Check for active subscriptions (today is between start and end)
    let sub = subscriptions.find((s) => isSubscriptionLive(s.status, s.startDate, s.endDate, d));
    if (sub) return sub;
    // Also check for upcoming subscriptions (today is before start)
    return subscriptions.find((s) => {
      const status = subscriptionStatus(s.status, s.startDate, s.endDate);
      return status === "upcoming";
    }) ?? null;
  }, [selectedDateStr, subscriptions]);

  const selectedSkip = useMemo(() =>
    selectedDateStr ? (skips.find((sk) => sk.originalDay.slice(0, 10) === selectedDateStr) ?? null) : null,
  [selectedDateStr, skips]);

  const selectedWeekLabel = useMemo(() =>
    selectedDateStr ? weekLabelForDate(new Date(selectedDateStr + "T12:00:00")) : null,
  [selectedDateStr]);

  const selectedDayNum = useMemo(() => {
    if (!selectedDateStr) return null;
    const dow = new Date(selectedDateStr + "T12:00:00").getDay();
    return dow === 0 ? 7 : dow;
  }, [selectedDateStr]);

  const selectedMenuItems = useMemo(() => {
    if (!selectedWeekLabel || !selectedDayNum) return [];
    return allMenuItems.filter((m) => m.weekLabel === selectedWeekLabel && m.day === selectedDayNum);
  }, [allMenuItems, selectedWeekLabel, selectedDayNum]);

  const selectedSelections = useMemo(() => {
    if (!selectedWeekLabel || !selectedDayNum || !selectedActiveSub) return [];
    return allSelections.filter((s) => s.subscriptionId === selectedActiveSub.id && s.weekLabel === selectedWeekLabel && s.day === selectedDayNum);
  }, [allSelections, selectedWeekLabel, selectedDayNum, selectedActiveSub]);

  // Per-day address override
  const selectedDayAddress = useMemo(() => {
    if (!selectedWeekLabel || !selectedDayNum || !selectedActiveSub) return null;
    return dayAddresses.find(
      (r) => r.subscriptionId === selectedActiveSub.id && r.weekLabel === selectedWeekLabel && r.day === selectedDayNum
    ) ?? null;
  }, [dayAddresses, selectedWeekLabel, selectedDayNum, selectedActiveSub]);

  // Per-day note local state (seeded when date changes)
  const [dayNoteValue, setDayNoteValue] = useState("");
  useEffect(() => {
    if (!selectedWeekLabel || !selectedDayNum) { setDayNoteValue(""); return; }
    const n = kitchenNotes.find((n) => n.weekLabel === selectedWeekLabel && n.day === selectedDayNum);
    setDayNoteValue(n?.note ?? "");
  }, [selectedWeekLabel, selectedDayNum, kitchenNotes]);

  const isPast = false;

  function prevMonth() { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); }

  function handleMealChange(mealNum: number, menuSlot: number | null) {
    if (!selectedWeekLabel || !selectedDayNum || !selectedActiveSub) return;
    startTransition(async () => {
      if (menuSlot === null) {
        await deleteSelectionDirectAction(`${selectedWeekLabel}-${selectedActiveSub.id}-${selectedDayNum}-${mealNum}`);
      } else {
        await upsertSelectionDirectAction({ weekLabel: selectedWeekLabel, subscriptionId: selectedActiveSub.id, day: selectedDayNum, mealNum, menuSlot });
      }
      onReload();
    });
  }

  function handleDayAddressChange(addressId: string) {
    if (!selectedWeekLabel || !selectedActiveSub || !selectedDayNum) return;
    startTransition(async () => {
      if (!addressId) {
        await deleteDayAddressAction(selectedActiveSub.id, selectedWeekLabel, selectedDayNum);
      } else {
        await upsertDayAddressAction(selectedActiveSub.id, selectedWeekLabel, selectedDayNum, addressId);
      }
      onReload();
    });
  }

  function handleDayNoteBlur() {
    if (!selectedWeekLabel || !selectedDayNum) return;
    startTransition(async () => {
      await upsertKitchenNoteAction(selectedWeekLabel, customerId, selectedDayNum, dayNoteValue.trim());
      onReload();
    });
  }

  function handleSkip() {
    if (!selectedDateStr || !selectedActiveSub) return;
    startTransition(async () => {
      await skipDayAndExtendAction(selectedActiveSub.id, selectedDateStr, null);
      onReload();
    });
  }

  function handleSkipRemove(skipId: string) {
    startTransition(async () => {
      await unskipDayAndShortenAction(skipId);
      onReload();
    });
  }

  return (
    <div className="space-y-2 border-t pt-3 mt-1">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Schedule</p>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ── Left Column: Calendar + Detail Panel ── */}
          <div className="space-y-3 max-h-[350px] overflow-y-auto">
          {/* Calendar */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <button type="button" onClick={prevMonth} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent">
                <ChevronLeft size={10} />
              </button>
              <span className="text-xs font-medium">{MONTH_NAMES[month]} {year}</span>
              <button type="button" onClick={nextMonth} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent">
                <ChevronRight size={10} />
              </button>
            </div>

            <div className="flex gap-2 items-start">
              <div className="space-y-0.5 flex-1">
                <div className="grid grid-cols-7">
                  {DAY_HDR.map((h, i) => (
                    <div key={i} className={`text-center text-[9px] font-medium py-0.5 ${i >= 5 ? "text-muted-foreground/40" : "text-muted-foreground/70"}`}>{h}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px">
                  {calDays.map((dateStr, i) => {
                    if (!dateStr) return <div key={`e${i}`} className="h-7" />;
                    const d = new Date(dateStr + "T12:00:00");
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isActive = !isWeekend && isLiveOrUpcomingOnDate(dateStr);
                    const isSkipped = skippedSet.has(dateStr);
                    const isReplacement = replacementSet.has(dateStr);
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDateStr;
                    const isClickable = !isWeekend && dateStr <= maxDateStr;

                    // Check if this is an end date for any non-cancelled subscription
                    const isEndDate = isActive && subscriptions.some(
                      (s) => s.status !== "cancelled" && localDateStr(new Date(s.endDate)) === dateStr
                    );

                    // Priority: skipped > replacement > today > end date > active-past(delivered) > active-future > inactive
                    let bg = "";
                    let tc = isWeekend ? "text-muted-foreground/40" : "text-muted-foreground/60";
                    if (isSkipped) {
                      bg = "bg-yellow-100 dark:bg-yellow-900/30"; tc = "text-yellow-800 dark:text-yellow-300";
                    } else if (isReplacement) {
                      bg = "bg-indigo-100 dark:bg-indigo-900/30"; tc = "text-indigo-700 dark:text-indigo-300";
                    } else if (isToday) {
                      bg = "bg-purple-500"; tc = "text-white font-bold";
                    } else if (isEndDate) {
                      bg = "bg-pink-300 dark:bg-pink-400/30"; tc = "text-pink-900 dark:text-pink-100";
                    } else if (isActive && dateStr < todayStr) {
                      bg = "bg-green-500/15"; tc = "text-green-700 dark:text-green-300";
                    } else if (isActive) {
                      bg = "bg-sky-200/60 dark:bg-sky-900/20"; tc = "text-sky-700 dark:text-sky-300";
                    }

                    // Border: today gets solid purple, selected gets dashed black/white
                    const borderClass = isToday && isSelected
                      ? "border-2 border-dashed border-purple-400 dark:border-purple-300"
                      : isToday
                      ? "border-2 border-purple-800 dark:border-purple-300"
                      : isSelected
                      ? "border-2 border-dashed border-black dark:border-white"
                      : "";

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={isClickable ? () => { setSelectedDateStr(dateStr); } : undefined}
                    className={[
                      "h-7 w-full rounded text-[11px] flex items-center justify-center transition-colors",
                      bg, tc, borderClass,
                      isClickable ? "hover:brightness-90 cursor-pointer" : "opacity-40 cursor-not-allowed",
                    ].filter(Boolean).join(" ")}
                  >
                    {isSkipped ? <s>{d.getDate()}</s> : d.getDate()}
                  </button>
                );
                  })}
                </div>
              </div>

                {/* Legend - right side */}
                <div className="flex flex-col gap-0.5 pt-4">
                  {[
                    ["bg-purple-500", "Today"],
                    ["bg-green-500/15 border border-green-200", "Delivered"],
                    ["bg-sky-200/60 border border-sky-300", "Upcoming"],
                    ["bg-pink-300 border border-pink-400", "End Date"],
                    ["bg-yellow-100", "Skipped"],
                    ["bg-indigo-100 border border-indigo-300", "Replacement"],
                  ].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1 text-[9px] text-muted-foreground whitespace-nowrap">
                      <span className={`w-2.5 h-2.5 rounded-sm ${c}`} />{l}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="space-y-1 min-w-0 text-xs">
            {!selectedDateStr ? (
              <p className="text-muted-foreground/50 italic text-[11px]">Click a date to manage meals and skips.</p>
            ) : (
              <>
                <p className="font-medium text-sm">
                  {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                {!selectedActiveSub ? (
                  <p className="text-muted-foreground text-[11px]">No active subscription on this date.</p>
                ) : (
                  <>
                    {/* Address (only if customer has multiple) */}
                    {addresses.length > 1 && (
                      <div className="space-y-0.5">
                        <select
                          className="w-full border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring"
                          value={selectedDayAddress?.addressId ?? ""}
                          onChange={(e) => handleDayAddressChange(e.target.value)}
                          disabled={isPending || isPast}
                        >
                          <option value="">Default address</option>
                          {addresses.map((a) => (
                            <option key={a.id} value={a.id} title={a.label}>
                              {a.address || a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Meals */}
                    <div className="space-y-0.5">
                      {selectedMenuItems.length === 0 ? (
                        <p className="text-muted-foreground/50 text-[11px]">No menu items.</p>
                      ) : (
                        Array.from({ length: selectedActiveSub.mealsPerDay }, (_, i) => i + 1).map((mealNum) => {
                          const cur = selectedSelections.find((s) => s.mealNum === mealNum);
                          return (
                            <div key={mealNum} className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground w-8 shrink-0">M{mealNum}</span>
                              <select
                                className="flex-1 border rounded px-1 py-0.5 text-[11px] bg-background outline-none focus:ring-1 focus:ring-ring min-w-[120px] whitespace-nowrap"
                                value={cur?.menuSlot ?? ""}
                                onChange={(e) => handleMealChange(mealNum, e.target.value ? Number(e.target.value) : null)}
                                disabled={isPending || isPast}
                              >
                                <option value="">—</option>
                                {selectedMenuItems.map((item) => (
                                  <option key={item.id} value={item.slot}>{item.name}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Per-day note */}
                    <div className="space-y-0.5">
                      <textarea
                        className="w-full min-h-[36px] rounded border border-input bg-transparent px-2 py-1 text-xs resize-none outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 placeholder:text-muted-foreground/50 disabled:opacity-50"
                        placeholder="Note..."
                        value={dayNoteValue}
                        onChange={(e) => setDayNoteValue(e.target.value)}
                        onBlur={handleDayNoteBlur}
                        disabled={isPending || isPast}
                      />
                    </div>

                    {/* Skip */}
                    {selectedSkip ? (
                      <div className="border rounded p-1.5 space-y-0.5 bg-yellow-50/60 dark:bg-yellow-900/10">
                        <p className="text-yellow-700 dark:text-yellow-400 font-medium text-[10px]">⊘ Skipped</p>
                        <button type="button" onClick={() => handleSkipRemove(selectedSkip.id)} disabled={isPending || isPast}
                          className="px-1.5 py-0.5 text-[10px] rounded border hover:bg-accent disabled:opacity-50">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleSkip} disabled={isPending || isPast}
                        className="px-1.5 py-0.5 text-[10px] rounded border hover:bg-accent disabled:opacity-50">
                        Skip day
                      </button>
                    )}
                  </>
              )}
            </>
          )}
        </div>
        </div>

        {/* ── Right Column: Minimap ── */}
        <div>
          {minimap}
        </div>
      </div>
    </div>
  );
});

export function CustomerOverlay({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [currentId, setCurrentId] = useState(customerId);
  const [isPending, startTransition] = useTransition();
  const prevOpenRef = useRef(false);
  const [routes, setRoutes] = useState<Map<string, { positions: [number, number][]; distance: number; duration: number }>>(new Map());
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Note
  const [noteValue, setNoteValue] = useState("");

  // Identity edit
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: "", phone: "", zone: "" });

  // Address edit
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ label: "", address: "", zone: "" });
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", address: "", zone: "" });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  // Subscription new / cancel / edit
  const [showAddSub, setShowAddSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback((id: string, clearFirst = true) => {
    if (clearFirst) {
      setDetails(null);
      setRoutes(new Map());
    }
    getCustomerDetailsAction(id).then((d) => {
      setDetails(d);
      setNoteValue(d.customer?.notes ?? "");
      if (d.customer) {
        setInfoForm({ name: d.customer.name, phone: d.customer.phone, zone: d.customer.zone });
      }
    });
  }, []);

  const reload = useCallback((id?: string) => {
    load(id ?? currentId, false);
  }, [currentId, load]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCurrentId(customerId);
      setEditingInfo(false);
      setEditingAddrId(null);
      setShowAddAddr(false);
      setShowAddSub(false);
      setEditingSubId(null);
      setCancellingId(null);
      load(customerId);
    }
    prevOpenRef.current = open;
  }, [open, customerId, load]);

  // Close on Esc; if an inline edit form is open, collapse it first
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (editingInfo) { setEditingInfo(false); return; }
      if (editingAddrId !== null) { setEditingAddrId(null); return; }
      if (showAddAddr) { setShowAddAddr(false); return; }
      if (showAddSub) { setShowAddSub(false); return; }
      if (editingSubId !== null) { setEditingSubId(null); return; }
      if (cancellingId !== null) { setCancellingId(null); return; }
      onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, editingInfo, editingAddrId, showAddAddr, showAddSub, editingSubId, cancellingId]);

  const handlePaymentCreated = useCallback((payment: Payment) => {
    setDetails((prev) => prev ? { ...prev, payments: [...prev.payments, payment] } : prev);
  }, []);

  const handlePaymentDeleted = useCallback((paymentId: string) => {
    setDetails((prev) => prev ? { ...prev, payments: prev.payments.filter((p) => p.id !== paymentId) } : prev);
  }, []);

  const handleSubscriptionCancelled = useCallback((result?: {
    subscription: Subscription | null;
    payment?: Payment;
    creditTransaction?: CreditTransaction;
  }) => {
    setCancellingId(null);
    if (!result?.subscription) {
      reload();
      return;
    }
    setDetails((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        subscriptions: prev.subscriptions.map((s) =>
          s.id === result.subscription!.id ? result.subscription! : s
        ),
        payments: result.payment ? [...prev.payments, result.payment] : prev.payments,
        creditTransactions: result.creditTransaction
          ? [...prev.creditTransactions, result.creditTransaction]
          : prev.creditTransactions,
      };
    });
  }, [reload]);

  // ── Fetch routes from hub to all customer addresses ─────────────
  // Stable key: only changes when address IDs or hub coords actually change,
  // not on every setDetails call (which replaces the array reference).
  const hubKey = details?.hub ? `${details.hub.lat},${details.hub.lng}` : null;
  const addrKey = details?.addresses
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => a.id)
    .join(',') ?? '';

  useEffect(() => {
    if (!details?.hub || !addrKey) return;

    const addressesWithCoords = details.addresses.filter(
      (a) => a.latitude != null && a.longitude != null
    );
    if (addressesWithCoords.length === 0) return;

    const controller = new AbortController();
    const { signal } = controller;
    setLoadingRoutes(true);
    const hub = details.hub;

    const fetchRoute = async (addr: CustomerAddress) => {
      try {
        const res = await fetch("/api/route-geometry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waypoints: [
              { lat: hub.lat, lng: hub.lng },
              { lat: addr.latitude!, lng: addr.longitude! },
            ],
          }),
          signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.positions) {
          return { addrId: addr.id, data };
        }
      } catch {
        // Ignore individual route fetch errors (including AbortError)
      }
      return null;
    };

    Promise.all(addressesWithCoords.map(fetchRoute)).then((results) => {
      if (signal.aborted) return;
      setRoutes(() => {
        const newRoutes = new Map<string, { positions: [number, number][]; distance: number; duration: number }>();
        results.forEach((result) => {
          if (result) {
            newRoutes.set(result.addrId, {
              positions: result.data.positions,
              distance: result.data.distance ?? 0,
              duration: result.data.duration ?? 0,
            });
          }
        });
        return newRoutes;
      });
      setLoadingRoutes(false);
    });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubKey, addrKey]);

  // ── Note ────────────────────────────────────────────────────────────────
  function handleNoteBlur() {
    if (!details?.customer) return;
    const notes = noteValue.trim() || null;
    if (notes === (details.customer.notes ?? null)) return;
    startTransition(async () => {
      await updateCustomerNoteAction(currentId, notes);
      setDetails((p) => p?.customer ? { ...p, customer: { ...p.customer, notes } } : p);
    });
  }

  // ── Identity ─────────────────────────────────────────────────────────────
  function startEditInfo() {
    if (!details?.customer) return;
    setInfoForm({ name: details.customer.name, phone: details.customer.phone, zone: details.customer.zone });
    setEditingInfo(true);
  }

  function saveInfo() {
    if (!infoForm.name.trim() || !infoForm.phone.trim()) return;
    startTransition(async () => {
      const { newId } = await updateCustomerInfoAction(currentId, infoForm);
      setCurrentId(newId);
      setEditingInfo(false);
      reload(newId);
    });
  }

  // ── Addresses ────────────────────────────────────────────────────────────
  function startEditAddr(addr: CustomerAddress) {
    setAddrForm({ label: addr.label, address: addr.address, zone: addr.zone });
    setEditingAddrId(addr.id);
    setShowAddAddr(false);
  }

  function saveEditAddr(id: string) {
    startTransition(async () => {
      await updateAddressFieldsAction(id, addrForm);
      setEditingAddrId(null);
      reload();
    });
  }

  function handleDeleteAddr(id: string) {
    startTransition(async () => {
      await deleteAddressAction(id);
      reload();
    });
  }

  function handleSetDefault(addressId: string) {
    startTransition(async () => {
      await setDefaultAddressAction(addressId, currentId);
      reload();
    });
  }

  function saveNewAddr() {
    if (!newAddr.address.trim()) return;
    startTransition(async () => {
      await addAddressAction({
        ...newAddr,
        customerId: currentId,
        isDefault: (details?.addresses.length ?? 0) === 0,
      });
      setShowAddAddr(false);
      setNewAddr({ label: "", address: "", zone: "" });
      reload();
    });
  }

  // ── Subscriptions ────────────────────────────────────────────────────────
  function handleRecover(id: string) {
    startTransition(async () => {
      await updateSubscriptionStatusAction(id, "active");
      reload();
    });
  }

  function handleDeleteSubscription(id: string) {
    if (!window.confirm("Permanently delete this subscription? This action cannot be undone.")) return;
    startTransition(async () => {
      await deleteSubscriptionAction(id);
      reload();
    });
  }

  const minimap = useMemo(() => {
    if (!details) return null;
    return (
      <CustomerMinimap
        addresses={details.addresses}
        hub={details.hub}
        routes={routes}
        loading={loadingRoutes}
      />
    );
  }, [details?.addresses, details?.hub, routes, loadingRoutes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[62vw] sm:max-w-[62vw] h-[88vh] max-h-[88vh] overflow-y-auto">
        {!details ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : details.customer === null ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Customer not found.</div>
        ) : (
          <>
            <DialogHeader>
              {editingInfo ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    className="w-full text-lg font-semibold bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
                    value={infoForm.name}
                    onChange={(e) => setInfoForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Name"
                  />
                  <input
                    className="w-full text-sm bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
                    value={infoForm.phone}
                    onChange={(e) => setInfoForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone"
                  />
                  <input
                    className="w-full text-sm bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
                    value={infoForm.zone}
                    onChange={(e) => setInfoForm((p) => ({ ...p, zone: e.target.value }))}
                    placeholder="Zone (optional)"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={saveInfo}
                      disabled={isPending || !infoForm.name.trim() || !infoForm.phone.trim()}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Check size={11} /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingInfo(false)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border hover:bg-accent"
                    >
                      <X size={11} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 pr-12">
                  <div className="flex items-center gap-2">
                    <DialogTitle>{details.customer.name}</DialogTitle>
                    <button
                      type="button"
                      onClick={startEditInfo}
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Edit name / phone / zone"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(details.customer!.name, "name")}
                      className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Copy name"
                    >
                      {copiedKey === "name" ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://zalo.me/${details.customer.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-blue-500 transition-colors"
                      title="Open in Zalo"
                    >
                      {details.customer.phone}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(details.customer!.phone, "phone")}
                      className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Copy phone"
                    >
                      {copiedKey === "phone" ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* ── Customer financial summary ──────────────────────────────── */}
            {(() => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const totalEarned = details.subscriptions.reduce(
                (s, sub) => s + earnedRevenueAsOf(sub, details.skips, details.extras, today),
                0
              );
              const totalCollected = details.payments.filter((p) => p.type === "payment").reduce((s, p) => s + p.amount, 0);
              const totalRefundCash = details.payments.filter((p) => p.type === "refund").reduce((s, p) => s + p.amount, 0);
              const totalRefundCredit = details.creditTransactions.filter((t) => t.type === "refund_credit").reduce((s, t) => s + t.amount, 0);
              const netCollected = totalCollected - totalRefundCash - totalRefundCredit;
              const totalBalance = details.subscriptions.reduce((s, sub) => {
                const subExtras = details.extras.filter((e) => e.subscriptionId === sub.id);
                const extrasTotal = subExtras.reduce((a, e) => a + e.amount, 0);
                const isCancelled = sub.status === "cancelled";
                const totalDue = isCancelled
                  ? calculateProratedTotalDue(sub, details.skips.filter((sk) => sk.subscriptionId === sub.id), subExtras)
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
                    <p className={`font-semibold ${totalBalance > 0 ? "text-red-600" : totalBalance < 0 ? "text-amber-600" : "text-green-600"}`}>
                      {totalBalance === 0 ? "✓ Clear" : `${Math.abs(totalBalance).toLocaleString()} VND`}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-1">
              {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
              <div className="space-y-4">
                {/* Addresses */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Addresses</p>
                    {!showAddAddr && (
                      <button type="button" onClick={() => { setShowAddAddr(true); setEditingAddrId(null); }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        <Plus size={11} /> Add
                      </button>
                    )}
                  </div>
                  {details.addresses.length === 0 && !showAddAddr && (
                    <p className="text-xs text-muted-foreground/50">No addresses saved.</p>
                  )}
                  <ul className="space-y-1">
                    {details.addresses.map((addr) =>
                      editingAddrId === addr.id ? (
                        <li key={addr.id} className="border rounded-lg p-2 space-y-1">
                          <input autoFocus
                            className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                            value={addrForm.label} onChange={(e) => setAddrForm((p) => ({ ...p, label: e.target.value }))} placeholder="Label" />
                          <input
                            className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                            value={addrForm.address} onChange={(e) => setAddrForm((p) => ({ ...p, address: e.target.value }))} placeholder="Full address" />
                          <input
                            className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                            value={addrForm.zone} onChange={(e) => setAddrForm((p) => ({ ...p, zone: e.target.value }))} placeholder="Zone" />
                          <div className="flex gap-1.5 pt-0.5">
                            <button type="button" onClick={() => saveEditAddr(addr.id)} disabled={isPending}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                              <Check size={10} /> Save
                            </button>
                            <button type="button" onClick={() => setEditingAddrId(null)}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border hover:bg-accent">
                              <X size={10} /> Cancel
                            </button>
                          </div>
                        </li>
                      ) : (
                        <li key={addr.id} className="flex items-start gap-1.5 group text-xs">
                          {addr.isDefault
                            ? <Star size={10} className="text-primary shrink-0 mt-0.5" />
                            : (
                              <button type="button" onClick={() => handleSetDefault(addr.id)} title="Set as default"
                                className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground shrink-0 mt-0.5">
                                <Star size={10} />
                              </button>
                            )
                          }
                          <div className="flex-1 min-w-0">
                             {addr.label && (
                               <span className={addr.isDefault ? "font-medium" : "text-muted-foreground"}>{addr.label} </span>
                             )}
                             <span className="text-muted-foreground break-words">{addr.address}</span>
                             {addr.zone && <span className="text-muted-foreground/60"> · {addr.zone}</span>}
                             <CoordsEditor addressId={addr.id} customerId={currentId} lat={addr.latitude} lng={addr.longitude} onSaved={reload} />
                             {addr.latitude != null && addr.longitude != null && getRouteInfo(routes, loadingRoutes, addr.id)}
                           </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                            <button type="button" onClick={() => copyToClipboard(addr.address, `addr-${addr.id}`)}
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Copy address">
                              {copiedKey === `addr-${addr.id}` ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                            </button>
                            <button type="button" onClick={() => startEditAddr(addr)}
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                              <Pencil size={10} />
                            </button>
                            <button type="button" onClick={() => handleDeleteAddr(addr.id)} disabled={isPending}
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-accent disabled:opacity-50">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </li>
                      )
                    )}
                    {showAddAddr && (
                      <li className="border rounded-lg p-2 space-y-1">
                        <input autoFocus
                          className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                          value={newAddr.label} onChange={(e) => setNewAddr((p) => ({ ...p, label: e.target.value }))} placeholder="Label (e.g. Home)" />
                        <input
                          className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                          value={newAddr.address} onChange={(e) => setNewAddr((p) => ({ ...p, address: e.target.value }))} placeholder="Full address" />
                        <input
                          className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                          value={newAddr.zone} onChange={(e) => setNewAddr((p) => ({ ...p, zone: e.target.value }))} placeholder="Zone" />
                        <div className="flex gap-1.5 pt-0.5">
                          <button type="button" onClick={saveNewAddr} disabled={isPending || !newAddr.address.trim()}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            <Check size={10} /> Add
                          </button>
                          <button type="button" onClick={() => { setShowAddAddr(false); setNewAddr({ label: "", address: "", zone: "" }); }}
                            className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border hover:bg-accent">
                            <X size={10} /> Cancel
                          </button>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Permanent note */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    Note
                    {isPending && <span className="font-normal normal-case opacity-60">saving…</span>}
                  </label>
                  <textarea
                    className="w-full min-h-[56px] rounded border border-input bg-transparent px-2 py-1.5 text-xs resize-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 placeholder:text-muted-foreground"
                    placeholder="No note"
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    onBlur={handleNoteBlur}
                  />
                </div>

                {/* Credit balance */}
                <CreditPanel
                  customerId={currentId}
                  creditTransactions={details.creditTransactions}
                  subscriptions={details.subscriptions}
                  onReload={reload}
                />
              </div>

              {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
              <div className="space-y-4">
                {/* Subscriptions */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Subscriptions</p>
                    {!showAddSub && (
                      <button type="button" onClick={() => { setShowAddSub(true); setEditingSubId(null); }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        <Plus size={11} /> New
                      </button>
                    )}
                  </div>
                  {showAddSub && (() => {
                    const creditBal = details.creditTransactions.reduce((acc, t) => {
                      if (t.type === "refund_credit" || t.type === "manual_topup" || t.type === "adjustment") return acc + t.amount;
                      if (t.type === "credit_used") return acc - t.amount;
                      return acc;
                    }, 0);
                    return (
                      <SubForm mode="create" customerId={currentId} pricing={details.pricing} mealPrices={details.mealPrices}
                        creditBalance={creditBal}
                        onSaved={() => { setShowAddSub(false); reload(); }}
                        onCancel={() => setShowAddSub(false)} />
                    );
                  })()}
                  {!showAddSub && editingSubId && (() => {
                    const editingSub = details.subscriptions.find(s => s.id === editingSubId);
                    return editingSub ? (
                      <SubForm mode="edit" subId={editingSub.id} customerId={currentId} pricing={details.pricing} mealPrices={details.mealPrices} initial={editingSub}
                        skips={details.skips.filter(s => s.subscriptionId === editingSub.id)}
                        onSaved={() => { setEditingSubId(null); reload(); }}
                        onCancel={() => setEditingSubId(null)} />
                    ) : null;
                  })()}
                  {details.subscriptions.length === 0 && !showAddSub && !editingSubId && (
                    <p className="text-xs text-muted-foreground/50">No subscriptions.</p>
                  )}
                  <div className="max-h-[380px] overflow-y-auto pr-1">
                  <ul className="space-y-1">
                    {[...details.subscriptions].sort((a, b) => {
                      const today = new Date();
                      const liveRank = (s: Subscription) =>
                        isSubscriptionLive(s.status, s.startDate, s.endDate, today) ? 0 : 1;
                      const r = liveRank(a) - liveRank(b);
                      return r !== 0 ? r : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }).map((sub) => {
                      const status = subscriptionStatus(sub.status, sub.startDate, sub.endDate);
                      const days = daysRemaining(sub.endDate);
                      const skips = details.skipCounts[sub.id] ?? 0;
                      const canAct = sub.status === "active";
                      const isCancelling = cancellingId === sub.id;
                      return (
                        <li key={sub.id} className="border rounded px-2 py-1 text-[11px]">
                            <>
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-medium capitalize">{sub.plan}</span>
                                  <span className={[
                                    "px-1 py-0.5 rounded-full text-[9px] shrink-0",
                                    status === "active" ? "bg-green-100 text-green-800"
                                      : status === "upcoming" ? "bg-blue-100 text-blue-800"
                                      : "bg-muted text-muted-foreground",
                                  ].join(" ")}>{status}</span>
                                  <span className="text-muted-foreground truncate">{sub.goal}·{sub.mealsPerDay}×/day</span>
                                </div>                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button type="button"
                                    onClick={() => { setEditingSubId(sub.id); setShowAddSub(false); setCancellingId(null); }}
                                    className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                                  >
                                    <Pencil size={9} />
                                  </button>
                                  <button type="button"
                                    onClick={() => handleDeleteSubscription(sub.id)}
                                    disabled={isPending}
                                    className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                </div>
                              </div>
                                {!isCancelling && (
                                <div className="flex items-center justify-between text-muted-foreground mt-0.5">
                                  <span className="truncate">
                                    <span>{(sub.subscriptionPrice + sub.shippingPrice - sub.discount).toLocaleString()} VND{sub.discount > 0 && <span className="text-[9px]"> (-{sub.discount.toLocaleString()} VND)</span>} · </span>
                                    Ends {fmt(sub.endDate)}
                                    {status === "active" && ` · ${days}d`}
                                    {skips > 0 && ` · ${skips} skip${skips !== 1 ? "s" : ""}`}
                                  </span>
                                </div>
                              )}
                              {!isCancelling && sub.status === "cancelled" && (sub.cancelledAt || sub.cancelReason) && (
                                <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-1.5 flex-wrap">
                                  {sub.cancelledAt && (
                                    <span>Cancelled {new Date(sub.cancelledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                                  )}
                                  {sub.cancelReason && <span>· {sub.cancelReason}</span>}
                                </div>
                              )}
                              {canAct && !isCancelling && (
                                <div className="flex gap-1 mt-0.5">
                                   <button type="button"
                                     onClick={() => {
                                       setCancellingId(sub.id);
                                       setEditingSubId(null);
                                     }}
                                    disabled={isPending}
                                    className="px-1.5 py-0.5 text-[10px] rounded border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto">
                                    Cancel
                                  </button>
                                </div>
                              )}
                              {sub.status === "cancelled" && (
                                <div className="flex gap-1 mt-0.5">
                                  <button type="button" onClick={() => handleRecover(sub.id)} disabled={isPending}
                                    className="px-1.5 py-0.5 text-[10px] rounded border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50">
                                    Recover
                                  </button>
                                </div>
                              )}
                              {isCancelling && (
                                <div className="pt-0.5">
                                  <CancelSubscriptionForm
                                    sub={sub}
                                    customerId={currentId}
                                    skips={details.skips.filter((s) => s.subscriptionId === sub.id)}
                                    payments={details.payments.filter((p) => p.subscriptionId === sub.id)}
                                    extras={details.extras.filter((e) => e.subscriptionId === sub.id)}
                                    onDone={handleSubscriptionCancelled}
                                    onCancel={() => { setCancellingId(null); }}
                                  />
                                </div>
                              )}
                              <ExtrasPanel
                                sub={sub}
                                extras={details.extras.filter((e) => e.subscriptionId === sub.id)}
                                onReload={reload}
                              />
                              <PaymentPanel sub={sub} payments={details.payments} extras={details.extras} skips={details.skips.filter((s) => s.subscriptionId === sub.id)} creditTransactions={details.creditTransactions} customerId={currentId} customerCredit={details.creditTransactions.reduce((acc, t) => { if (t.type === "refund_credit" || t.type === "manual_topup" || t.type === "adjustment") return acc + t.amount; if (t.type === "credit_used") return acc - t.amount; return acc; }, 0)} onReload={reload} onPaymentCreated={handlePaymentCreated} onPaymentDeleted={handlePaymentDeleted} />
                             </>
                         </li>
                      );
                    })}
                  </ul>
                  </div>
                </div>

              </div>

              {/* Minimap removed from here - now in SchedulePanel */}
            </div>

            {/* ── Schedule ── */}
            <SchedulePanel
              subscriptions={details.subscriptions}
              addresses={details.addresses}
              skips={details.skips}
              allSelections={details.allSelections}
              allMenuItems={details.allMenuItems}
              kitchenNotes={details.kitchenNotes}
              dayAddresses={details.dayAddresses}
              customerId={currentId}
              onReload={reload}
              minimap={minimap}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
