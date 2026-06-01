"use client";

import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { skipDayAndExtendAction, unskipDayAndShortenAction } from "@/app/actions/skips";
import { upsertSelectionDirectAction, deleteSelectionDirectAction } from "@/app/actions/selections";
import { updateMealPlanForDateAction } from "@/app/actions/meal-delivery-plans";
import { upsertSubscriptionDayNoteAction } from "@/app/actions/subscription-day-notes";
import { upsertDayAddressAction, deleteDayAddressAction } from "@/app/actions/order-day-addresses";
import type { Subscription, CustomerAddress, MealSkip, MealSelection, MealDeliveryPlan, MenuItem, SubscriptionDayNote, OrderDayAddress } from "@/lib/data/types";
import { subscriptionStatus, localDateStr, addWorkingDays } from "@/lib/utils/subscription";
import { plannedMealsBeforeDate, plannedMealsForDate, totalMealEntitlement } from "@/lib/utils/schedule";
import { weekLabelForDate } from "@/lib/utils/week";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HDR = ["M","T","W","T","F","S","S"];

function sortSubscriptions(a: Subscription, b: Subscription) {
  const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  if (startDiff !== 0) return startDiff;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function isSubscriptionOnDate(sub: Subscription, dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const dMid = new Date(d);
  dMid.setHours(0, 0, 0, 0);
  const start = new Date(sub.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(sub.endDate);
  end.setHours(0, 0, 0, 0);
  return sub.status !== "cancelled" && dMid >= start && dMid <= end;
}

function SubscriptionCalendar({
  subscription,
  year,
  month,
  calDays,
  selectedDateStr,
  todayStr,
  maxDateStr,
  skips,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: {
  subscription: Subscription;
  year: number;
  month: number;
  calDays: (string | null)[];
  selectedDateStr: string | null;
  todayStr: string;
  maxDateStr: string;
  skips: MealSkip[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateStr: string) => void;
}) {
  const skippedSet = useMemo(
    () => new Set(skips.filter((s) => s.subscriptionId === subscription.id).map((s) => localDateStr(new Date(s.originalDay)))),
    [skips, subscription.id]
  );
  const replacementSet = useMemo(
    () => new Set(skips.filter((s) => s.subscriptionId === subscription.id && s.replacementDay).map((s) => localDateStr(new Date(s.replacementDay!)))),
    [skips, subscription.id]
  );
  const endDateStr = localDateStr(new Date(subscription.endDate));
  const status = subscriptionStatus(subscription.status, subscription.startDate, subscription.endDate);

  return (
    <div className="space-y-1.5 rounded border p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium capitalize">{subscription.plan} · {subscription.goal}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(subscription.startDate).toLocaleDateString("en-GB")} - {new Date(subscription.endDate).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onPrevMonth} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent">
            <ChevronLeft size={10} />
          </button>
          <span className="min-w-[86px] text-center text-[10px] font-medium">{MONTH_NAMES[month]} {year}</span>
          <button type="button" onClick={onNextMonth} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent">
            <ChevronRight size={10} />
          </button>
        </div>
      </div>
      <p className="text-[10px] capitalize text-muted-foreground">{status}</p>

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
          const isActive = !isWeekend && isSubscriptionOnDate(subscription, dateStr);
          const isSkipped = skippedSet.has(dateStr);
          const isReplacement = replacementSet.has(dateStr);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDateStr;
          const isClickable = !isWeekend && dateStr <= maxDateStr;
          const isEndDate = isActive && endDateStr === dateStr;

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
              onClick={isClickable ? () => onSelectDate(dateStr) : undefined}
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
  );
}

export const SchedulePanel = memo(function SchedulePanel({
  subscriptions,
  addresses,
  skips,
  allSelections,
  mealDeliveryPlans,
  allMenuItems,
  subscriptionDayNotes,
  dayAddresses,
  customerNote,
  customerId,
  onReload,
}: {
  subscriptions: Subscription[];
  addresses: CustomerAddress[];
  skips: MealSkip[];
  allSelections: MealSelection[];
  mealDeliveryPlans: MealDeliveryPlan[];
  allMenuItems: MenuItem[];
  subscriptionDayNotes: SubscriptionDayNote[];
  dayAddresses: OrderDayAddress[];
  customerNote: string;
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
    const firstDow = new Date(year, month, 1).getDay();
    const startCol = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < startCol; i++) days.push(null);
    const total = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= total; d++) days.push(localDateStr(new Date(year, month, d)));
    return days;
  }, [year, month]);

  const calendarSubscriptions = useMemo(() => {
    return subscriptions
      .filter((s) => s.status !== "cancelled")
      .sort(sortSubscriptions);
  }, [subscriptions]);

  const subscriptionsForDate = useCallback((dateStr: string) => {
    return subscriptions
      .filter((s) => isSubscriptionOnDate(s, dateStr))
      .sort(sortSubscriptions);
  }, [subscriptions]);

  const selectedSubscriptions = useMemo(() => {
    return selectedDateStr ? subscriptionsForDate(selectedDateStr) : [];
  }, [selectedDateStr, subscriptionsForDate]);

  const selectedSkipBySub = useMemo(() => {
    const map = new Map<string, MealSkip>();
    if (!selectedDateStr) return map;
    for (const sk of skips) {
      if (localDateStr(new Date(sk.originalDay)) === selectedDateStr) {
        map.set(sk.subscriptionId, sk);
      }
    }
    return map;
  }, [selectedDateStr, skips]);

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

  const selectedSelectionsBySub = useMemo(() => {
    const map = new Map<string, MealSelection[]>();
    if (!selectedWeekLabel || !selectedDayNum) return map;
    for (const sub of selectedSubscriptions) {
      map.set(
        sub.id,
        allSelections.filter((s) => s.subscriptionId === sub.id && s.weekLabel === selectedWeekLabel && s.day === selectedDayNum)
      );
    }
    return map;
  }, [allSelections, selectedWeekLabel, selectedDayNum, selectedSubscriptions]);

  const selectedDayAddressBySub = useMemo(() => {
    const map = new Map<string, OrderDayAddress>();
    if (!selectedWeekLabel || !selectedDayNum) return map;
    for (const r of dayAddresses) {
      if (r.weekLabel === selectedWeekLabel && r.day === selectedDayNum) {
        map.set(r.subscriptionId, r);
      }
    }
    return map;
  }, [dayAddresses, selectedWeekLabel, selectedDayNum]);

  const selectedPlannedMealsBySub = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedDateStr) return map;
    for (const sub of selectedSubscriptions) {
      map.set(sub.id, plannedMealsForDate(sub, selectedDateStr, mealDeliveryPlans, skips));
    }
    return map;
  }, [selectedDateStr, selectedSubscriptions, mealDeliveryPlans, skips]);

  const selectedRemainingBeforeBySub = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedDateStr) return map;
    for (const sub of selectedSubscriptions) {
      map.set(
        sub.id,
        Math.max(0, totalMealEntitlement(sub) - plannedMealsBeforeDate(sub, selectedDateStr, mealDeliveryPlans, skips))
      );
    }
    return map;
  }, [selectedDateStr, selectedSubscriptions, mealDeliveryPlans, skips]);

  const [subDayNoteDrafts, setSubDayNoteDrafts] = useState<Record<string, string>>({});
  const [mealCountDraft, setMealCountDraft] = useState<{
    date: string | null;
    values: Record<string, string>;
    errors: Record<string, string | null>;
  }>({ date: null, values: {}, errors: {} });

  const isPast = false;

  function prevMonth() { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); }

  function handleMealChange(subscriptionId: string, mealNum: number, menuSlot: number | null) {
    if (!selectedWeekLabel || !selectedDayNum) return;
    startTransition(async () => {
      if (menuSlot === null) {
        await deleteSelectionDirectAction(`${selectedWeekLabel}-${subscriptionId}-${selectedDayNum}-${mealNum}`);
      } else {
        await upsertSelectionDirectAction({ weekLabel: selectedWeekLabel, subscriptionId, day: selectedDayNum, mealNum, menuSlot });
      }
      onReload();
    });
  }

  function handleDayAddressChange(subscriptionId: string, addressId: string) {
    if (!selectedWeekLabel || !selectedDayNum) return;
    startTransition(async () => {
      if (!addressId) {
        await deleteDayAddressAction(subscriptionId, selectedWeekLabel, selectedDayNum);
      } else {
        await upsertDayAddressAction(subscriptionId, selectedWeekLabel, selectedDayNum, addressId);
      }
      onReload();
    });
  }

  function handleSubDayNoteBlur(subscriptionId: string) {
    if (!selectedWeekLabel || !selectedDayNum) return;
    const draftKey = `${subscriptionId}-${selectedWeekLabel}-${selectedDayNum}`;
    const value = subDayNoteDrafts[draftKey] ?? subscriptionDayNotes.find(
      (n) => n.subscriptionId === subscriptionId && n.weekLabel === selectedWeekLabel && n.day === selectedDayNum
    )?.note ?? "";
    startTransition(async () => {
      await upsertSubscriptionDayNoteAction(subscriptionId, selectedWeekLabel, selectedDayNum, value.trim());
      onReload();
    });
  }

  function subDayNoteValueFor(subscriptionId: string): string {
    if (!selectedWeekLabel || !selectedDayNum) return "";
    const draftKey = `${subscriptionId}-${selectedWeekLabel}-${selectedDayNum}`;
    if (draftKey in subDayNoteDrafts) return subDayNoteDrafts[draftKey];
    return subscriptionDayNotes.find(
      (n) => n.subscriptionId === subscriptionId && n.weekLabel === selectedWeekLabel && n.day === selectedDayNum
    )?.note ?? "";
  }

  function mealCountValueFor(subscriptionId: string, plannedMeals: number) {
    if (mealCountDraft.date === selectedDateStr && mealCountDraft.values[subscriptionId] != null) {
      return mealCountDraft.values[subscriptionId];
    }
    return String(plannedMeals);
  }

  function handleMealCountBlur(sub: Subscription) {
    if (!selectedDateStr) return;
    const selectedPlannedMeals = selectedPlannedMealsBySub.get(sub.id) ?? 0;
    const plannedMeals = Math.max(0, Math.floor(parseInt(mealCountValueFor(sub.id, selectedPlannedMeals), 10) || 0));
    if (plannedMeals === selectedPlannedMeals) return;
    startTransition(async () => {
      const result = await updateMealPlanForDateAction({
        subscriptionId: sub.id,
        date: selectedDateStr,
        plannedMeals,
        reason: "manual daily meal count",
      });
      if (!result.ok) {
        const remainingBefore = selectedRemainingBeforeBySub.get(sub.id) ?? 0;
        setMealCountDraft((prev) => ({
          date: selectedDateStr,
          values: {
            ...(prev.date === selectedDateStr ? prev.values : {}),
            [sub.id]: String(selectedPlannedMeals),
          },
          errors: {
            ...(prev.date === selectedDateStr ? prev.errors : {}),
            [sub.id]: result.error === "exceeds_remaining_meals"
              ? `Only ${remainingBefore} meal(s) remain before this date.`
              : "Could not update meal count.",
          },
        }));
        return;
      }
      onReload();
    });
  }

  function handleSkip(subscriptionId: string) {
    if (!selectedDateStr) return;
    startTransition(async () => {
      await skipDayAndExtendAction(subscriptionId, selectedDateStr, null);
      onReload();
    });
  }

  function handleSkipRemove(skipId: string) {
    startTransition(async () => {
      await unskipDayAndShortenAction(skipId);
      onReload();
    });
  }

  function renderSubscriptionEditor(sub: Subscription) {
    if (!selectedDateStr) {
      return (
        <p className="text-muted-foreground/50 italic text-[11px]">Click a date to manage meals and skips.</p>
      );
    }

    if (!isSubscriptionOnDate(sub, selectedDateStr)) {
      return (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-sm">
            {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </p>
          <p className="text-muted-foreground text-[11px]">This subscription is not active on this date.</p>
        </div>
      );
    }

    const selectedSkip = selectedSkipBySub.get(sub.id) ?? null;
    const selectedDayAddress = selectedDayAddressBySub.get(sub.id) ?? null;
    const selectedSelections = selectedSelectionsBySub.get(sub.id) ?? [];
    const selectedPlannedMeals = selectedPlannedMealsBySub.get(sub.id) ?? 0;
    const selectedRemainingBefore = selectedRemainingBeforeBySub.get(sub.id) ?? 0;
    const mealCountError = mealCountDraft.date === selectedDateStr ? (mealCountDraft.errors[sub.id] ?? null) : null;

    return (
      <div className="space-y-1.5 rounded border p-2 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">
              {new Date(selectedDateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Default {sub.mealsPerDay}x/day · End {new Date(sub.endDate).toLocaleDateString("en-GB")}
            </p>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground shrink-0">
            {selectedPlannedMeals} meal{selectedPlannedMeals === 1 ? "" : "s"}
          </span>
        </div>

        {addresses.length > 1 && (
          <select
            className="w-full border rounded px-1 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring"
            value={selectedDayAddress?.addressId ?? ""}
            onChange={(e) => handleDayAddressChange(sub.id, e.target.value)}
            disabled={isPending || isPast}
          >
            <option value="">Default address</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id} title={a.label}>
                {a.address || a.label}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground shrink-0">Meals</span>
          <input
            type="number"
            min={0}
            max={selectedRemainingBefore}
            className="w-16 border rounded px-1 py-0.5 text-xs bg-background text-center outline-none focus:ring-1 focus:ring-ring"
            value={mealCountValueFor(sub.id, selectedPlannedMeals)}
            onChange={(e) => {
              const value = e.target.value;
              setMealCountDraft((prev) => ({
                date: selectedDateStr,
                values: {
                  ...(prev.date === selectedDateStr ? prev.values : {}),
                  [sub.id]: value,
                },
                errors: {
                  ...(prev.date === selectedDateStr ? prev.errors : {}),
                  [sub.id]: null,
                },
              }));
            }}
            onBlur={() => handleMealCountBlur(sub)}
            disabled={isPending || isPast || !!selectedSkip}
          />
          <span className="text-[10px] text-muted-foreground">
            of {selectedRemainingBefore} left before this day
          </span>
        </div>
        {mealCountError && <p className="text-[10px] text-destructive">{mealCountError}</p>}

        <div className="space-y-0.5">
          {selectedMenuItems.length === 0 ? (
            <p className="text-muted-foreground/50 text-[11px]">No menu items.</p>
          ) : selectedPlannedMeals === 0 ? (
            <p className="text-muted-foreground/50 text-[11px]">No meals planned for this subscription.</p>
          ) : (
            Array.from({ length: selectedPlannedMeals }, (_, i) => i + 1).map((mealNum) => {
              const cur = selectedSelections.find((s) => s.mealNum === mealNum);
              return (
                <div key={mealNum} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-8 shrink-0">M{mealNum}</span>
                  <select
                    className="flex-1 border rounded px-1 py-0.5 text-[11px] bg-background outline-none focus:ring-1 focus:ring-ring min-w-[120px] whitespace-nowrap"
                    value={cur?.menuSlot ?? ""}
                    onChange={(e) => handleMealChange(sub.id, mealNum, e.target.value ? Number(e.target.value) : null)}
                    disabled={isPending || isPast || !!selectedSkip}
                  >
                    <option value="">-</option>
                    {selectedMenuItems.map((item) => (
                      <option key={item.id} value={item.slot}>{item.name}</option>
                    ))}
                  </select>
                </div>
              );
            })
          )}
        </div>

        {selectedSkip ? (
          <div className="border rounded p-1.5 space-y-0.5 bg-yellow-50/60 dark:bg-yellow-900/10">
            <p className="text-yellow-700 dark:text-yellow-400 font-medium text-[10px]">Skipped</p>
            <button
              type="button"
              onClick={() => handleSkipRemove(selectedSkip.id)}
              disabled={isPending || isPast}
              className="px-1.5 py-0.5 text-[10px] rounded border hover:bg-accent disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleSkip(sub.id)}
            disabled={isPending || isPast}
            className="px-1.5 py-0.5 text-[10px] rounded border hover:bg-accent disabled:opacity-50"
          >
            Skip subscription
          </button>
        )}

        <div className="space-y-0.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Day note</label>
          <textarea
            className="w-full min-h-[36px] rounded border border-input bg-transparent px-2 py-1 text-xs resize-none outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30 placeholder:text-muted-foreground/50 disabled:opacity-50"
            placeholder="Note for this day…"
            value={subDayNoteValueFor(sub.id)}
            onChange={(e) => {
              const draftKey = `${sub.id}-${selectedWeekLabel}-${selectedDayNum}`;
              setSubDayNoteDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }));
            }}
            onBlur={() => handleSubDayNoteBlur(sub.id)}
            disabled={isPending}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t pt-3 mt-1">
      {customerNote && (
        <div className="rounded border border-input bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 mb-0.5">Permanent note</span>
          <span className="whitespace-pre-wrap break-words">{customerNote}</span>
        </div>
      )}
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Schedule</p>
      <div className="space-y-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-1">
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

        <div className="space-y-3">
          {calendarSubscriptions.length === 0 ? (
            <p className="text-muted-foreground text-[11px]">No active subscriptions.</p>
          ) : (
            calendarSubscriptions.map((sub) => (
              <div key={sub.id} className="grid grid-cols-1 gap-3 border-b pb-3 last:border-b-0 last:pb-0 xl:grid-cols-[minmax(240px,0.9fr)_minmax(280px,1.1fr)]">
                <SubscriptionCalendar
                  subscription={sub}
                  year={year}
                  month={month}
                  calDays={calDays}
                  selectedDateStr={selectedDateStr}
                  todayStr={todayStr}
                  maxDateStr={maxDateStr}
                  skips={skips}
                  onPrevMonth={prevMonth}
                  onNextMonth={nextMonth}
                  onSelectDate={setSelectedDateStr}
                />
                <div className="min-w-0">{renderSubscriptionEditor(sub)}</div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
});
