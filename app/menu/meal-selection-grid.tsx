"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { upsertSelectionAction, deleteSelectionAction } from "../actions/selections";
import { skipDayFromMenuAction, deleteMealSkipAction } from "../actions/skips";
import { upsertKitchenNoteAction } from "../actions/notes";

type CustomerData = {
  id: string;
  name: string;
  mealsPerDay: number;
  goal: string;
  startDate: string;
  endDate: string;
  subscriptionId: string;
  skips: { dayNum: number; skipId: string }[];
  notes: string | null;
};

type Props = {
  weekLabel: string;
  weekMonday: string;
  activeCustomers: CustomerData[];
  menuItems: { day: number; slot: number; name: string; goals: string }[];
  selections: { customerId: string; day: number; mealNum: number; menuSlot: number }[];
  notes?: { customerId: string; day: number; note: string }[];
  onCustomerClick?: (customerId: string) => void;
};

const DAYS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
];

export function MealSelectionGrid({ weekLabel, weekMonday, activeCustomers, menuItems, selections, notes = [], onCustomerClick }: Props) {
  const router = useRouter();
  const [showNames, setShowNames] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  // editingNoteKey = `${customerId}-${day}`
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteValues, setNoteValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(notes.map((n) => [`${n.customerId}-${n.day}`, n.note]))
  );
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const monday = new Date(weekMonday);
  monday.setHours(0, 0, 0, 0);
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  function isDayInRange(cust: CustomerData, dayNum: number): boolean {
    const dayDate = weekDates[dayNum - 1];
    const start = new Date(cust.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(cust.endDate); end.setHours(0, 0, 0, 0);
    return dayDate >= start && dayDate < end;
  }

  function getMenuName(day: number, slot: number) {
    return menuItems.find((m) => m.day === day && m.slot === slot)?.name ?? (slot === 1 ? "Cơm" : "Bún");
  }

  function getSelection(customerId: string, day: number, mealNum: number) {
    return selections.find((s) => s.customerId === customerId && s.day === day && s.mealNum === mealNum);
  }

  async function handleSelect(customerId: string, day: number, mealNum: number, menuSlot: number) {
    const key = `${customerId}-${day}-${mealNum}-sel`;
    setPending(key);
    const existing = getSelection(customerId, day, mealNum);
    if (existing?.menuSlot === menuSlot) {
      const selId = `${weekLabel}-${customerId}-${day}-${mealNum}`;
      await deleteSelectionAction(selId);
    } else {
      const fd = new FormData();
      fd.set("weekLabel", weekLabel);
      fd.set("customerId", customerId);
      fd.set("day", String(day));
      fd.set("mealNum", String(mealNum));
      fd.set("menuSlot", String(menuSlot));
      await upsertSelectionAction(fd);
    }
    setPending(null);
    router.refresh();
  }

  async function handleSkip(subscriptionId: string, dayNum: number) {
    const key = `${subscriptionId}-${dayNum}-skip`;
    setPending(key);
    const dayDate = weekDates[dayNum - 1];
    await skipDayFromMenuAction(subscriptionId, dayDate.toISOString());
    setPending(null);
    router.refresh();
  }

  async function handleUnskip(skipId: string, subscriptionId: string, dayNum: number) {
    const key = `${subscriptionId}-${dayNum}-skip`;
    setPending(key);
    await deleteMealSkipAction(skipId);
    setPending(null);
    router.refresh();
  }

  function startEditNote(customerId: string, day: number) {
    setEditingNoteKey(`${customerId}-${day}`);
    setTimeout(() => noteInputRef.current?.focus(), 0);
  }

  async function saveNote(customerId: string, day: number) {
    const key = `${customerId}-${day}`;
    setEditingNoteKey(null);
    const note = noteValues[key] ?? "";
    await upsertKitchenNoteAction(weekLabel, customerId, day, note);
    router.refresh();
  }

  if (activeCustomers.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No active customers with subscriptions.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="px-3 pt-2 flex items-center justify-end">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Show meal names
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50 min-w-[120px]">Customer</th>
              {DAYS.map(({ num, label }) => (
                <th key={num} className="text-center px-2 py-2 font-medium" style={{ minWidth: showNames ? 140 : 90 }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {activeCustomers.map((cust) => (
              <tr key={cust.id} className="hover:bg-accent/30">
                <td className="px-3 py-2 sticky left-0 bg-background">
                  <button
                    type="button"
                    onClick={() => onCustomerClick?.(cust.id)}
                    className="font-medium text-sm text-left hover:underline focus:outline-none"
                  >
                    {cust.name}
                  </button>
                  {cust.notes && (
                    <span className="block text-xs text-muted-foreground truncate max-w-[8rem]">{cust.notes}</span>
                  )}
                  <div className="text-muted-foreground text-xs">{cust.mealsPerDay}×/day · {cust.goal}</div>
                </td>
                {DAYS.map(({ num }) => {
                  const inRange = isDayInRange(cust, num);
                  const skipEntry = cust.skips.find((s) => s.dayNum === num);
                  const isSkipped = !!skipEntry;
                  const skipPendingKey = `${cust.subscriptionId}-${num}-skip`;
                  const isSkipPending = pending === skipPendingKey;

                  // Out of subscription range
                  if (!inRange) {
                    return (
                      <td key={num} className="px-2 py-2">
                        <div className="flex flex-col gap-0.5">
                          {Array.from({ length: cust.mealsPerDay }, (_, i) => (
                            <div key={i} className="px-1 py-0.5 rounded text-[10px] text-center text-muted-foreground/30 bg-muted/10 select-none">
                              —
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // Skipped day — show clickable "skip" to undo
                  if (isSkipped) {
                    return (
                      <td key={num} className="px-2 py-2">
                        <div className="flex flex-col gap-0.5">
                          {Array.from({ length: cust.mealsPerDay }, (_, i) => (
                            <button
                              key={i}
                              disabled={isSkipPending}
                              onClick={() => handleUnskip(skipEntry.skipId, cust.subscriptionId, num)}
                              className="px-1 py-0.5 rounded text-[10px] text-center w-full text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                              title="Click to remove skip"
                            >
                              {isSkipPending ? "…" : "skip ×"}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  }

                  // Normal selectable day — A / B / Skip + Note
                  const noteKey = `${cust.id}-${num}`;
                  const noteValue = noteValues[noteKey] ?? "";
                  const isEditingNote = editingNoteKey === noteKey;
                  return (
                    <td key={num} className="px-2 py-2">
                      <div className="space-y-0.5">
                        {Array.from({ length: cust.mealsPerDay }, (_, mealIdx) => {
                          const mealNum = mealIdx + 1;
                          const sel = getSelection(cust.id, num, mealNum);
                          const selPendingKey = `${cust.id}-${num}-${mealNum}-sel`;
                          const isSelPending = pending === selPendingKey;
                          return (
                            <div key={mealNum} className="flex gap-0.5">
                              <button
                                disabled={isSelPending || isSkipPending}
                                onClick={() => handleSelect(cust.id, num, mealNum, 1)}
                                className={`flex-1 px-1 py-0.5 rounded text-[10px] border transition-colors disabled:opacity-50 text-center leading-tight ${
                                  showNames ? "whitespace-normal" : "truncate"
                                } ${
                                  sel?.menuSlot === 1
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/50 hover:bg-muted border-transparent"
                                }`}
                                title={getMenuName(num, 1)}
                              >
                                {showNames ? getMenuName(num, 1) : "A"}
                              </button>
                              <button
                                disabled={isSelPending || isSkipPending}
                                onClick={() => handleSelect(cust.id, num, mealNum, 2)}
                                className={`flex-1 px-1 py-0.5 rounded text-[10px] border transition-colors disabled:opacity-50 text-center leading-tight ${
                                  showNames ? "whitespace-normal" : "truncate"
                                } ${
                                  sel?.menuSlot === 2
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted/50 hover:bg-muted border-transparent"
                                }`}
                                title={getMenuName(num, 2)}
                              >
                                {showNames ? getMenuName(num, 2) : "B"}
                              </button>
                              {mealIdx === 0 && (
                                <button
                                  disabled={isSkipPending || isSelPending}
                                  onClick={() => handleSkip(cust.subscriptionId, num)}
                                  className="flex-1 px-1 py-0.5 rounded text-[10px] border border-transparent text-muted-foreground hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors disabled:opacity-50"
                                  title="Skip this day"
                                >
                                  {isSkipPending ? "…" : "Skip"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {/* Per-day note */}
                        {isEditingNote ? (
                          <textarea
                            ref={noteInputRef}
                            value={noteValue}
                            onChange={(e) => setNoteValues((prev) => ({ ...prev, [noteKey]: e.target.value }))}
                            onBlur={() => saveNote(cust.id, num)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setEditingNoteKey(null);
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(cust.id, num); }
                            }}
                            rows={2}
                            placeholder="Note for kitchen…"
                            className="w-full mt-0.5 text-[10px] bg-transparent border border-primary rounded px-1 py-0.5 outline-none resize-none leading-tight"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditNote(cust.id, num)}
                            className={`w-full mt-0.5 text-left text-[10px] px-1 py-0.5 rounded transition-colors leading-tight ${
                              noteValue
                                ? "text-blue-600 hover:bg-blue-50"
                                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/50"
                            }`}
                            title="Click to add/edit note"
                          >
                            {noteValue || "+ note"}
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
