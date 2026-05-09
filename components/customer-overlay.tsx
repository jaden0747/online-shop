"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  extendSubscriptionRenewalAction,
  createSubscriptionAction,
  updateSubscriptionAction,
} from "@/app/actions/subscriptions";
import { skipDayAndExtendAction, unskipDayAndShortenAction } from "@/app/actions/skips";
import { upsertSelectionDirectAction, deleteSelectionDirectAction } from "@/app/actions/selections";
import { upsertKitchenNoteAction } from "@/app/actions/notes";
import { upsertDayAddressAction, deleteDayAddressAction } from "@/app/actions/order-day-addresses";
import type { Customer, CustomerAddress, Subscription, Pricing, MealSkip, MealSelection, MenuItem, KitchenNote, OrderDayAddress } from "@/lib/data/types";
import { subscriptionStatus, daysRemaining, planTotalMeals, addWorkingDays, isSubscriptionLive } from "@/lib/utils/subscription";
import { weekLabelForDate } from "@/lib/utils/week";
import { Pencil, X, Plus, Star, Trash2, Check, MapPin, ChevronLeft, ChevronRight } from "lucide-react";

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
};

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
const GOALS = ["cutting", "maintenance", "bulking"];
const PLANS = ["trial", "weekly", "monthly"];

function SubForm({
  mode,
  subId,
  customerId,
  pricing,
  initial,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  subId?: string;
  customerId: string;
  pricing: Pricing[];
  initial?: Subscription;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState(initial?.plan ?? "weekly");
  const [goal, setGoal] = useState(initial?.goal ?? "cutting");
  const [meals, setMeals] = useState(initial?.mealsPerDay ?? 2);
  const [trialDays, setTrialDays] = useState(initial?.trialDays ?? 3);
  const [startDate, setStartDate] = useState(
    initial?.startDate ? initial.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [renewalDate, setRenewalDate] = useState(
    initial?.renewalDate ? initial.renewalDate.slice(0, 10) : ""
  );
  const [subPrice, setSubPrice] = useState(initial ? String(initial.subscriptionPrice) : "");
  const [shipPrice, setShipPrice] = useState(initial ? String(initial.shippingPrice) : "");
  const [autoRenewal, setAutoRenewal] = useState(mode === "create");
  const [saving, startSave] = useTransition();

  // Auto-fill price from pricing table (create mode only, or when plan/goal/meals change in edit)
  const didMount = useRef(false);
  useEffect(() => {
    if (mode === "edit" && !didMount.current) { didMount.current = true; return; }
    didMount.current = true;
    const match = pricing.find((p) => p.plan === plan && p.goal === goal && p.mealsPerDay === meals);
    if (match && mode === "create") setSubPrice(String(match.totalPrice));
  }, [plan, goal, meals, pricing, mode]);

  // Auto-compute renewal when plan/startDate/trialDays change (only if auto mode)
  useEffect(() => {
    if (!autoRenewal) return;
    try {
      const start = new Date(startDate);
      const days = plan === "weekly" ? 5 : plan === "monthly" ? 20 : trialDays;
      setRenewalDate(addWorkingDays(start, days).toISOString().slice(0, 10));
    } catch { /* ignore */ }
  }, [plan, startDate, trialDays, autoRenewal]);

  function submit() {
    if (mode === "create") {
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("plan", plan);
      fd.set("goal", goal);
      fd.set("mealsPerDay", String(meals));
      fd.set("subscriptionPrice", subPrice);
      fd.set("shippingPrice", shipPrice || "0");
      fd.set("startDate", startDate);
      if (plan === "trial") fd.set("trialDays", String(trialDays));
      startSave(async () => { await createSubscriptionAction(fd); onSaved(); });
    } else {
      if (!subId) return;
      startSave(async () => {
        await updateSubscriptionAction(subId, {
          plan, goal, mealsPerDay: meals,
          subscriptionPrice: parseFloat(subPrice) || 0,
          shippingPrice: parseFloat(shipPrice) || 0,
          trialDays: plan === "trial" ? trialDays : null,
          startDate: new Date(startDate),
          renewalDate: new Date(renewalDate),
        });
        onSaved();
      });
    }
  }

  const totalMeals = planTotalMeals(plan) * meals;
  const sel = "w-full border rounded px-1.5 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";
  const inp = "w-full border rounded px-1.5 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Plan</label>
          <select className={sel} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Goal</label>
          <select className={sel} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Meals/day</label>
          <select className={sel} value={meals} onChange={(e) => setMeals(Number(e.target.value))}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      {plan === "trial" && (
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Trial days</label>
          <input className={inp} type="number" min={1} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Start</label>
          <input className={inp} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1">
            Renewal
            <button type="button" onClick={() => setAutoRenewal((v) => !v)}
              className={"text-[9px] px-1 rounded " + (autoRenewal ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
              {autoRenewal ? "auto" : "manual"}
            </button>
          </label>
          <input className={inp} type="date" value={renewalDate}
            readOnly={autoRenewal}
            onChange={(e) => { setAutoRenewal(false); setRenewalDate(e.target.value); }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Sub price</label>
          <input className={inp} type="number" placeholder="0" value={subPrice} onChange={(e) => setSubPrice(e.target.value)} />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-muted-foreground">Ship price</label>
          <input className={inp} type="number" placeholder="0" value={shipPrice} onChange={(e) => setShipPrice(e.target.value)} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{totalMeals} meals total</p>
      <div className="flex gap-1.5">
        <button type="button" onClick={submit} disabled={saving || !subPrice}
          className="flex items-center gap-1 px-2.5 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Check size={11} /> {mode === "create" ? "Create" : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-0.5 text-xs rounded border hover:bg-accent">
          <X size={11} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function SchedulePanel({
  subscriptions,
  addresses,
  skips,
  allSelections,
  allMenuItems,
  kitchenNotes,
  dayAddresses,
  customerId,
  onReload,
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

  const skippedSet = useMemo(() => new Set(skips.map((s) => s.originalDay.slice(0, 10))), [skips]);
  const replacementSet = useMemo(() => new Set(skips.filter((s) => s.replacementDay).map((s) => s.replacementDay!.slice(0, 10))), [skips]);

  const isActiveOnDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return subscriptions.some((s) => isSubscriptionLive(s.status, s.startDate, s.renewalDate, d));
  }, [subscriptions]);

  const selectedActiveSub = useMemo(() => {
    if (!selectedDateStr) return null;
    const d = new Date(selectedDateStr + "T12:00:00");
    return subscriptions.find((s) => isSubscriptionLive(s.status, s.startDate, s.renewalDate, d)) ?? null;
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
    if (!selectedWeekLabel || !selectedDayNum) return [];
    return allSelections.filter((s) => s.weekLabel === selectedWeekLabel && s.day === selectedDayNum);
  }, [allSelections, selectedWeekLabel, selectedDayNum]);

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
    if (!selectedWeekLabel || !selectedDayNum) return;
    startTransition(async () => {
      if (menuSlot === null) {
        await deleteSelectionDirectAction(`${selectedWeekLabel}-${customerId}-${selectedDayNum}-${mealNum}`);
      } else {
        await upsertSelectionDirectAction({ weekLabel: selectedWeekLabel, customerId, day: selectedDayNum, mealNum, menuSlot });
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
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">

        {/* ── Calendar ── */}
        <div className="space-y-1 w-[224px]">
          <div className="flex items-center justify-between">
            <button type="button" onClick={prevMonth} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent">
              <ChevronLeft size={12} />
            </button>
            <span className="text-xs font-medium">{MONTH_NAMES[month]} {year}</span>
            <button type="button" onClick={nextMonth} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent">
              <ChevronRight size={12} />
            </button>
          </div>
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
              const isActive = !isWeekend && isActiveOnDate(dateStr);
              const isSkipped = skippedSet.has(dateStr);
              const isReplacement = replacementSet.has(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDateStr;
              const isClickable = !isWeekend && dateStr <= maxDateStr;

              // Priority: skipped > replacement > today > active-past(delivered) > active-future > inactive
              let bg = "";
              let tc = isWeekend ? "text-muted-foreground/40" : "text-muted-foreground/60";
              if (isSkipped) {
                bg = "bg-yellow-100 dark:bg-yellow-900/30"; tc = "text-yellow-800 dark:text-yellow-300";
              } else if (isReplacement) {
                bg = "bg-blue-100 dark:bg-blue-900/30"; tc = "text-blue-700 dark:text-blue-400";
              } else if (isToday) {
                bg = "bg-emerald-600"; tc = "text-white font-bold";
              } else if (isActive && dateStr < todayStr) {
                bg = "bg-muted/60"; tc = "text-muted-foreground/70";
              } else if (isActive) {
                bg = "bg-emerald-50 dark:bg-emerald-900/10"; tc = "text-emerald-700 dark:text-emerald-300";
              }

              // Border: today gets solid emerald, selected gets dashed primary
              const borderClass = isToday && isSelected
                ? "border-2 border-dashed border-emerald-400"
                : isToday
                ? "border-2 border-emerald-800"
                : isSelected
                ? "border-2 border-dashed border-primary"
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
          <div className="flex flex-wrap gap-2.5 pt-0.5">
            {[
              ["bg-emerald-600", "Today"],
              ["bg-muted/60", "Delivered"],
              ["bg-emerald-50 border border-emerald-200", "Upcoming"],
              ["bg-yellow-100", "Skipped"],
              ["bg-blue-100", "Replacement"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className={`w-2.5 h-2.5 rounded-sm ${c}`} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* ── Detail panel ── */}
        <div className="space-y-2.5 min-w-0 text-xs">
          {!selectedDateStr ? (
            <p className="text-muted-foreground/50 italic">Click a date to manage meals and skips.</p>
          ) : (
            <>
              <p className="font-medium">
                {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              {!selectedActiveSub ? (
                <p className="text-muted-foreground">No active subscription on this date.</p>
              ) : (
                <>
                  {/* Address (only if customer has multiple) */}
                  {addresses.length > 1 && (
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-muted-foreground">Delivery address for this day</label>
                      <select
                        className="w-full border rounded px-1.5 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring"
                        value={selectedDayAddress?.addressId ?? ""}
                        onChange={(e) => handleDayAddressChange(e.target.value)}
                        disabled={isPending || isPast}
                      >
                        <option value="">Use customer default</option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label ? `${a.label} — ` : ""}{a.address}
                            {a.isDefault ? " (default)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Meals */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Meals</label>
                    {selectedMenuItems.length === 0 ? (
                      <p className="text-muted-foreground/50">No menu items set for this week/day.</p>
                    ) : (
                      Array.from({ length: selectedActiveSub.mealsPerDay }, (_, i) => i + 1).map((mealNum) => {
                        const cur = selectedSelections.find((s) => s.mealNum === mealNum);
                        return (
                          <div key={mealNum} className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-10 shrink-0">Meal {mealNum}</span>
                            <select
                              className="flex-1 border rounded px-1.5 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring"
                              value={cur?.menuSlot ?? ""}
                              onChange={(e) => handleMealChange(mealNum, e.target.value ? Number(e.target.value) : null)}
                              disabled={isPending || isPast}
                            >
                              <option value="">— not selected —</option>
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
                    <label className="text-[10px] text-muted-foreground">Day note</label>
                    <textarea
                      className="w-full min-h-[48px] rounded border border-input bg-transparent px-2 py-1.5 text-xs resize-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 placeholder:text-muted-foreground disabled:opacity-50"
                      placeholder="Allergies, preferences…"
                      value={dayNoteValue}
                      onChange={(e) => setDayNoteValue(e.target.value)}
                      onBlur={handleDayNoteBlur}
                      disabled={isPending || isPast}
                    />
                  </div>

                  {/* Skip */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Skip</label>
                    {selectedSkip ? (
                      <div className="border rounded-lg p-2 space-y-1 bg-yellow-50/60 dark:bg-yellow-900/10">
                        <p className="text-yellow-700 dark:text-yellow-400 font-medium text-[11px]">⊘ This day is skipped</p>
                        {selectedSkip.replacementDay && (
                          <p className="text-muted-foreground text-[11px]">
                            Replacement: {new Date(selectedSkip.replacementDay).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                        <button type="button" onClick={() => handleSkipRemove(selectedSkip.id)} disabled={isPending || isPast}
                          className="px-2 py-0.5 rounded border hover:bg-accent disabled:opacity-50">
                          Remove skip
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleSkip} disabled={isPending || isPast}
                        className="px-2 py-0.5 rounded border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed">
                        Skip this day
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

  // Subscription new / cancel / edit
  const [showAddSub, setShowAddSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCurrentId(customerId);
      setEditingInfo(false);
      setEditingAddrId(null);
      setShowAddAddr(false);
      setShowAddSub(false);
      setEditingSubId(null);
      setCancellingId(null);
      setCancelReason("");
      load(customerId);
    }
    prevOpenRef.current = open;
  }, [open, customerId]);

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
      if (cancellingId !== null) { setCancellingId(null); setCancelReason(""); return; }
      onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, editingInfo, editingAddrId, showAddAddr, showAddSub, editingSubId, cancellingId]);

  function load(id: string, clearFirst = true) {
    if (clearFirst) setDetails(null);
    getCustomerDetailsAction(id).then((d) => {
      setDetails(d);
      setNoteValue(d.customer?.notes ?? "");
      if (d.customer) {
        setInfoForm({ name: d.customer.name, phone: d.customer.phone, zone: d.customer.zone });
      }
    });
  }

  function reload(id?: string) {
    load(id ?? currentId, false);
  }

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
  function handlePause(id: string) {
    startTransition(async () => {
      await updateSubscriptionStatusAction(id, "paused");
      reload();
    });
  }

  function handleResume(id: string) {
    startTransition(async () => {
      await updateSubscriptionStatusAction(id, "active");
      reload();
    });
  }

  function handleExtend(id: string) {
    startTransition(async () => {
      await extendSubscriptionRenewalAction(id);
      reload();
    });
  }

  function handleRecover(id: string) {
    startTransition(async () => {
      await updateSubscriptionStatusAction(id, "active");
      reload();
    });
  }

  function handleCancelConfirm(id: string) {
    startTransition(async () => {
      await updateSubscriptionStatusAction(id, "cancelled", cancelReason.trim() || undefined);
      setCancellingId(null);
      setCancelReason("");
      reload();
    });
  }
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
                  </div>
                  <p className="text-sm text-muted-foreground">{details.customer.phone}</p>
                </div>
              )}
            </DialogHeader>

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
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
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
                    className="w-full min-h-[56px] rounded border border-input bg-transparent px-2 py-1.5 text-sm resize-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 placeholder:text-muted-foreground"
                    placeholder="No note"
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    onBlur={handleNoteBlur}
                  />
                </div>
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
                  {showAddSub && (
                    <SubForm mode="create" customerId={currentId} pricing={details.pricing}
                      onSaved={() => { setShowAddSub(false); reload(); }}
                      onCancel={() => setShowAddSub(false)} />
                  )}
                  {details.subscriptions.length === 0 && !showAddSub && (
                    <p className="text-xs text-muted-foreground/50">No subscriptions.</p>
                  )}
                  <div className="max-h-[60vh] overflow-y-auto pr-1">
                  <ul className="space-y-1.5">
                    {[...details.subscriptions].sort((a, b) => {
                      const today = new Date();
                      const liveRank = (s: Subscription) =>
                        isSubscriptionLive(s.status, s.startDate, s.renewalDate, today) ? 0
                          : s.status === "paused" ? 1 : 2;
                      const r = liveRank(a) - liveRank(b);
                      return r !== 0 ? r : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    }).map((sub) => {
                      const status = subscriptionStatus(sub.status, sub.startDate, sub.renewalDate);
                      const days = daysRemaining(sub.renewalDate);
                      const skips = details.skipCounts[sub.id] ?? 0;
                      const canAct = sub.status === "active" || sub.status === "paused";
                      const extendLabel = sub.plan === "weekly" ? "1w" : sub.plan === "trial" ? `${sub.trialDays ?? 3}d` : "1mo";
                      const isCancelling = cancellingId === sub.id;
                      const isEditing = editingSubId === sub.id;
                      return (
                        <li key={sub.id} className="border rounded-lg px-2.5 py-2 space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium capitalize text-sm">{sub.plan}</span>
                            <div className="flex items-center gap-1">
                              <span className={[
                                "px-1.5 py-0.5 rounded-full text-[10px]",
                                status === "active" ? "bg-green-100 text-green-800"
                                  : status === "upcoming" ? "bg-blue-100 text-blue-800"
                                  : "bg-muted text-muted-foreground",
                              ].join(" ")}>{status}</span>
                              {!isEditing && (
                                <button type="button"
                                  onClick={() => { setEditingSubId(sub.id); setShowAddSub(false); setCancellingId(null); }}
                                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                                  <Pencil size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <SubForm mode="edit" subId={sub.id} customerId={currentId} pricing={details.pricing} initial={sub}
                              onSaved={() => { setEditingSubId(null); reload(); }}
                              onCancel={() => setEditingSubId(null)} />
                          ) : (
                            <>
                              <p className="text-muted-foreground capitalize">{sub.goal} · {sub.mealsPerDay}×/day</p>
                              {(sub.subscriptionPrice > 0 || sub.shippingPrice > 0) && (
                                <p className="text-muted-foreground">
                                  ₫{sub.subscriptionPrice.toLocaleString()}
                                  {sub.shippingPrice > 0 && ` + ₫${sub.shippingPrice.toLocaleString()} ship`}
                                  {" · "}₫{(sub.subscriptionPrice + sub.shippingPrice).toLocaleString()} total
                                </p>
                              )}
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Renews {fmt(sub.renewalDate)}{status === "active" && ` · ${days}d`}</span>
                                {skips > 0 && <span>{skips} skip{skips !== 1 ? "s" : ""}</span>}
                              </div>
                              {canAct && !isCancelling && (
                                <div className="flex gap-1 pt-0.5 flex-wrap">
                                  {sub.status === "active" && (
                                    <button type="button" onClick={() => handlePause(sub.id)} disabled={isPending}
                                      className="px-2 py-0.5 rounded border hover:bg-accent disabled:opacity-50">Pause</button>
                                  )}
                                  {sub.status === "paused" && (
                                    <button type="button" onClick={() => handleResume(sub.id)} disabled={isPending}
                                      className="px-2 py-0.5 rounded border hover:bg-accent disabled:opacity-50">Resume</button>
                                  )}
                                  <button type="button" onClick={() => handleExtend(sub.id)} disabled={isPending}
                                    className="px-2 py-0.5 rounded border hover:bg-accent disabled:opacity-50"
                                    title={`Extend by ${extendLabel}`}>+{extendLabel}</button>
                                  <button type="button"
                                    onClick={() => { setCancellingId(sub.id); setCancelReason(""); setEditingSubId(null); }}
                                    disabled={isPending}
                                    className="px-2 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto">
                                    Cancel
                                  </button>
                                </div>
                              )}
                              {sub.status === "cancelled" && !isEditing && (
                                <div className="flex gap-1 pt-0.5">
                                  <button type="button" onClick={() => handleRecover(sub.id)} disabled={isPending}
                                    className="px-2 py-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50">
                                    Recover
                                  </button>
                                </div>
                              )}
                              {isCancelling && (
                                <div className="pt-0.5 space-y-1">
                                  <input autoFocus
                                    className="w-full border rounded px-2 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring"
                                    placeholder="Reason (optional)" value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)} />
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => handleCancelConfirm(sub.id)} disabled={isPending}
                                      className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                                      Confirm
                                    </button>
                                    <button type="button" onClick={() => { setCancellingId(null); setCancelReason(""); }}
                                      className="px-2 py-0.5 rounded border hover:bg-accent">Keep</button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Schedule (only when at least one live subscription) ── */}
            {details.subscriptions.some((s) =>
              isSubscriptionLive(s.status, s.startDate, s.renewalDate, new Date())
            ) && (
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
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
