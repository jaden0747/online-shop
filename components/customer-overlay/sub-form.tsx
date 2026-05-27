"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { createSubscriptionAction, updateSubscriptionAction } from "@/app/actions/subscriptions";
import { applyCreditToSubscriptionAction } from "@/app/actions/credits";
import type { Subscription, Pricing, MealSkip } from "@/lib/data/types";
import { planTotalMeals, addWorkingDays, localDateStr } from "@/lib/utils/subscription";
import {
  defaultWeeklySchedule,
  parseWeeklySchedule,
  serializeWeeklySchedule,
  weeklyScheduleTotal,
  validateWeeklySchedule,
} from "@/lib/utils/schedule";
import type { WeeklyMealSchedule } from "@/lib/data/types";
import { PLANS, GOALS } from "@/lib/constants";
import { Check, X } from "lucide-react";

const DAY_LABELS: [keyof WeeklyMealSchedule, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
];

export function SubForm({
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

  // Custom weekly schedule state
  const [useCustomSchedule, setUseCustomSchedule] = useState(
    !!initial?.weeklyScheduleJson
  );
  const [schedule, setSchedule] = useState<WeeklyMealSchedule>(() =>
    parseWeeklySchedule(initial?.weeklyScheduleJson ?? null, initial?.mealsPerDay ?? 2)
  );
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
  const [applyCredit, setApplyCredit] = useState(false);
  const [creditApplyAmt, setCreditApplyAmt] = useState("");
  const [saving, startSave] = useTransition();

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
    // Reset custom schedule when mealsPerDay or plan changes
    setSchedule(defaultWeeklySchedule(meals));
    if (plan === "trial") setUseCustomSchedule(false);
  }, [plan, goal, meals, pricing, mode, mealPrices, trialDays]);

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
      if (useCustomSchedule && plan !== "trial") {
        fd.set("weeklyScheduleJson", serializeWeeklySchedule(schedule));
      }
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
      const submitEndDateNoSkip = autoRenewal ? endDateNoSkip : endDate;
      startSave(async () => {
        await updateSubscriptionAction(subId, {
          plan, goal, mealsPerDay: meals,
          weeklyScheduleJson: useCustomSchedule && plan !== "trial"
            ? serializeWeeklySchedule(schedule)
            : null,
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
  const defaultCreditAmt = String(Math.min(customerCreditBalance, Math.max(0, totalPrice)));

  const scheduleTotal = weeklyScheduleTotal(schedule);
  const scheduleError =
    useCustomSchedule && plan !== "trial"
      ? validateWeeklySchedule(schedule, plan, meals)
      : null;

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
      {/* Custom weekly schedule (non-trial only) */}
      {plan !== "trial" && (
        <div className="space-y-0.5">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              className="h-3 w-3"
              checked={useCustomSchedule}
              onChange={(e) => {
                setUseCustomSchedule(e.target.checked);
                if (e.target.checked) setSchedule(defaultWeeklySchedule(meals));
              }}
            />
            <span className="text-[10px] text-muted-foreground">Custom schedule</span>
          </label>
          {useCustomSchedule && (
            <div className="border rounded p-1.5 space-y-1">
              <div className="grid grid-cols-5 gap-1">
                {DAY_LABELS.map(([day, label]) => (
                  <label key={day} className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-muted-foreground">{label}</span>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded px-1 py-0.5 text-xs bg-background text-center outline-none focus:ring-1 focus:ring-ring"
                      value={schedule[day]}
                      onChange={(e) =>
                        setSchedule((prev) => ({
                          ...prev,
                          [day]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className={`text-[10px] ${scheduleError ? "text-red-500" : "text-muted-foreground"}`}>
                {scheduleError ?? `Total: ${scheduleTotal} / ${meals * 5} meals/week`}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {totalMeals} meals · {totalPrice.toLocaleString()} VND
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={submit} disabled={saving || !subPrice || !!scheduleError}
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
