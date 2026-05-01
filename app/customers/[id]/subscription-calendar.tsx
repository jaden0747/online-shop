"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { skipDayFromMenuAction, deleteMealSkipAction } from "../../actions/skips";

type Skip = { id: string; originalDay: string };

type Props = {
  subscriptionId: string;
  startDate: string;
  endDate: string;
  skips: Skip[];
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type WeekRow = {
  monday: Date;
  cells: Date[];       // always 5 (Mon–Fri)
  showMonth: boolean;
  monthLabel: string;
};

function buildWeeks(start: Date, end: Date): WeekRow[] {
  // Start from the Monday of the week containing `start`
  const firstMonday = new Date(start);
  firstMonday.setHours(0, 0, 0, 0);
  const dow = firstMonday.getDay();
  firstMonday.setDate(firstMonday.getDate() - (dow === 0 ? 6 : dow - 1));

  const weeks: WeekRow[] = [];
  const cur = new Date(firstMonday);
  let lastMonth = -1;

  while (cur < end) {
    const monday = new Date(cur);
    const cells = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    // Use the first in-range cell's month for the label, fallback to monday
    const labelDate = cells.find(d => d >= start && d < end) ?? monday;
    const month = labelDate.getMonth();
    const showMonth = month !== lastMonth;
    if (showMonth) lastMonth = month;
    weeks.push({ monday, cells, showMonth, monthLabel: MONTH_NAMES[month] });
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

export function SubscriptionCalendar({ subscriptionId, startDate, endDate, skips }: Props) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const start = new Date(startDate); start.setHours(0, 0, 0, 0);
  const end   = new Date(endDate);   end.setHours(0, 0, 0, 0);
  const today = new Date();          today.setHours(0, 0, 0, 0);

  const weeks = buildWeeks(start, end);

  // Pre-index skips by date timestamp for O(1) lookup
  const skipByTime = new Map<number, Skip>();
  for (const sk of skips) {
    const d = new Date(sk.originalDay); d.setHours(0, 0, 0, 0);
    skipByTime.set(d.getTime(), sk);
  }

  function dateKey(d: Date) {
    return d.toISOString().split("T")[0];
  }

  async function toggle(date: Date) {
    const key = dateKey(date);
    setPendingKey(key);
    const existing = skipByTime.get(date.getTime());
    if (existing) {
      await deleteMealSkipAction(existing.id);
    } else {
      await skipDayFromMenuAction(subscriptionId, date.toISOString());
    }
    setPendingKey(null);
    router.refresh();
  }

  const skipCount = skips.length;

  return (
    <div className="space-y-2">
      {/* Day-of-week header */}
      <div className="grid grid-cols-[28px_repeat(5,1fr)] gap-1">
        <div />
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-[10px] font-medium text-muted-foreground text-center">{l}</div>
        ))}
      </div>

      {/* Week rows */}
      <div className="space-y-px">
        {weeks.map(({ monday, cells, showMonth, monthLabel }) => (
          <div key={monday.toISOString()}>
            {showMonth && (
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide pt-1.5 pb-0.5 pl-0.5">
                {monthLabel}
              </div>
            )}
            <div className="grid grid-cols-[28px_repeat(5,1fr)] gap-1">
              {/* Week-of-month number (optional visual aid) */}
              <div className="flex items-center justify-end pr-1">
                <span className="text-[9px] text-muted-foreground/40">
                  {Math.ceil(monday.getDate() / 7)}
                </span>
              </div>
              {cells.map((date) => {
                const inRange = date >= start && date < end;
                const isToday = date.getTime() === today.getTime();
                const isPast = date < today;
                const skip = skipByTime.get(date.getTime());
                const isSkipped = !!skip;
                const key = dateKey(date);
                const isPending = pendingKey === key;

                if (!inRange) {
                  return (
                    <div
                      key={key}
                      className="rounded py-1 text-center text-[11px] text-muted-foreground/20 select-none"
                    >
                      {date.getDate()}
                    </div>
                  );
                }

                return (
                  <button
                    key={key}
                    disabled={isPending}
                    onClick={() => toggle(date)}
                    title={isSkipped ? "Click to unskip" : "Click to skip"}
                    className={[
                      "rounded py-1 text-center text-[11px] font-medium transition-colors select-none",
                      "disabled:opacity-40",
                      isSkipped
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : isPast
                        ? "text-muted-foreground hover:bg-muted"
                        : "hover:bg-primary/10 text-foreground",
                      isToday ? "ring-1 ring-primary ring-inset" : "",
                    ].join(" ")}
                  >
                    <div>{date.getDate()}</div>
                    {isSkipped && !isPending && (
                      <div className="text-[8px] leading-tight text-amber-600">skip</div>
                    )}
                    {isPending && (
                      <div className="text-[8px] leading-tight text-muted-foreground">…</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground pt-1">
        {skipCount === 0 ? "No skips" : `${skipCount} skip${skipCount !== 1 ? "s" : ""}`}
        {" · click a date to toggle"}
      </p>
    </div>
  );
}
