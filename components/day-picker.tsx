"use client";

import { useRouter, usePathname } from "next/navigation";

function prevWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return fmt(d);
}

function nextWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return fmt(d);
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return fmt(new Date());
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DayPicker({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const isToday = date === todayStr();
  const d = new Date(date + "T00:00:00");
  const dayName = DAY_NAMES[d.getDay()];

  function go(target: string) {
    router.push(`${pathname}?date=${target}`);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => go(prevWeekday(date))}
        className="h-8 w-8 flex items-center justify-center rounded border bg-background hover:bg-accent text-sm transition-colors"
        title="Previous weekday"
      >
        ‹
      </button>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground w-7">{dayName}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => { if (e.target.value) go(e.target.value); }}
          className="h-8 px-2 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <button
        type="button"
        onClick={() => go(nextWeekday(date))}
        className="h-8 w-8 flex items-center justify-center rounded border bg-background hover:bg-accent text-sm transition-colors"
        title="Next weekday"
      >
        ›
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={() => go(todayStr())}
          className="h-8 px-3 text-xs rounded border bg-background hover:bg-accent transition-colors ml-1"
        >
          Today
        </button>
      )}
    </div>
  );
}
