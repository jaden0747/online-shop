"use client";

import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { skipDayAndExtendAction, unskipDayAndShortenAction } from "@/app/actions/skips";
import { upsertSelectionDirectAction, deleteSelectionDirectAction } from "@/app/actions/selections";
import { upsertKitchenNoteAction } from "@/app/actions/notes";
import { upsertDayAddressAction, deleteDayAddressAction } from "@/app/actions/order-day-addresses";
import type { Subscription, CustomerAddress, MealSkip, MealSelection, MenuItem, KitchenNote, OrderDayAddress } from "@/lib/data/types";
import { subscriptionStatus, localDateStr, addWorkingDays, isSubscriptionLive } from "@/lib/utils/subscription";
import { weekLabelForDate } from "@/lib/utils/week";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HDR = ["M","T","W","T","F","S","S"];

export const SchedulePanel = memo(function SchedulePanel({
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
    const firstDow = new Date(year, month, 1).getDay();
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
      if (status === "upcoming" || status === "expired") {
        const start = new Date(s.startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(s.endDate); end.setHours(0, 0, 0, 0);
        const dMid = new Date(d); dMid.setHours(0, 0, 0, 0);
        return dMid >= start && dMid <= end;
      }
      return false;
    });
  }, [subscriptions]);

  const selectedActiveSub = useMemo(() => {
    if (!selectedDateStr) return null;
    const d = new Date(selectedDateStr + "T12:00:00");
    let sub = subscriptions.find((s) => isSubscriptionLive(s.status, s.startDate, s.endDate, d));
    if (sub) return sub;
    return subscriptions.find((s) => subscriptionStatus(s.status, s.startDate, s.endDate) === "upcoming") ?? null;
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

  const selectedDayAddress = useMemo(() => {
    if (!selectedWeekLabel || !selectedDayNum || !selectedActiveSub) return null;
    return dayAddresses.find(
      (r) => r.subscriptionId === selectedActiveSub.id && r.weekLabel === selectedWeekLabel && r.day === selectedDayNum
    ) ?? null;
  }, [dayAddresses, selectedWeekLabel, selectedDayNum, selectedActiveSub]);

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
                    const isEndDate = isActive && subscriptions.some(
                      (s) => s.status !== "cancelled" && localDateStr(new Date(s.endDate)) === dateStr
                    );

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
                        onClick={isClickable ? () => setSelectedDateStr(dateStr) : undefined}
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

              {/* Legend */}
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
