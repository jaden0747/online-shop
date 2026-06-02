"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MenuSlot } from "./menu-slot";
import { MealSelectionGrid } from "./meal-selection-grid";
import type { MenuItem } from "@/lib/data/types";
import { weekLabelToDateRange } from "@/lib/utils/week";
import { CustomerOverlay } from "@/components/customer-overlay";

const DAYS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
];

type Selection = { subscriptionId: string; day: number; mealNum: number; menuSlot: number };

type SubRow = {
  subscriptionId: string;
  mealsPerDay: number;
  mealCounts: Record<number, number>;
  goal: string;
  plan: string;
  startDate: string;
  endDate: string;
  skips: { dayNum: number; skipId: string }[];
};

type CustomerGroup = {
  customerId: string;
  name: string;
  notes: string | null;
  subscriptions: SubRow[];
};

export type WeekData = {
  weekLabel: string;
  weekMondayISO: string;
  formattedLabel: string;
  isCurrentWeek: boolean;
  menuItems: MenuItem[];
  selections: Selection[];
  customerGroups: CustomerGroup[];
  notes: { customerId: string; day: number; note: string }[];
  subDayNotes: { subscriptionId: string; day: number; note: string }[];
};


export function MenuTabs({ thisWeek, nextWeek }: { thisWeek: WeekData; nextWeek: WeekData }) {
  const [tab, setTab] = useState<"this" | "next">(() => {
    const d = new Date().getDay();
    return d === 0 || d === 6 ? "next" : "this";
  });
  const [overlayCustomerId, setOverlayCustomerId] = useState<string | null>(null);
  const data = tab === "this" ? thisWeek : nextWeek;
  const todayDow = new Date().getDay();

  const byDaySlot = new Map(data.menuItems.map((item) => [`${item.day}-${item.slot}`, item]));

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(data.weekMondayISO);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Build the exact set of meal cells rendered in the selection grid. This
  // prevents stale selections from cancelled/out-of-range subscriptions from
  // inflating the production totals.
  const skippedKeys = new Set<string>();
  const eligibleSelectionKeys = new Set<string>();
  for (const group of data.customerGroups) {
    for (const sub of group.subscriptions) {
      const subStart = new Date(sub.startDate);
      subStart.setHours(0, 0, 0, 0);
      const subEnd = new Date(sub.endDate);
      subEnd.setHours(0, 0, 0, 0);

      for (const sk of sub.skips) {
        skippedKeys.add(`${sub.subscriptionId}-${sk.dayNum}`);
      }

      for (const { num } of DAYS) {
        const dayDate = weekDates[num - 1];
        if (dayDate < subStart || dayDate > subEnd) continue;
        if (skippedKeys.has(`${sub.subscriptionId}-${num}`)) continue;

        const mealCount = sub.mealCounts[num] ?? sub.mealsPerDay;
        for (let mealNum = 1; mealNum <= mealCount; mealNum += 1) {
          eligibleSelectionKeys.add(`${sub.subscriptionId}-${num}-${mealNum}`);
        }
      }
    }
  }

  const totals = new Map<string, number>();
  for (const sel of data.selections) {
    if (!eligibleSelectionKeys.has(`${sel.subscriptionId}-${sel.day}-${sel.mealNum}`)) continue;
    const key = `${sel.day}-${sel.menuSlot}`;
    totals.set(key, (totals.get(key) || 0) + 1);
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(["this", "next"] as const).map((t) => {
          const label = t === "this" ? "This Week" : "Next Week";
          const weekData = t === "this" ? thisWeek : nextWeek;
          const sublabel = weekLabelToDateRange(weekData.weekLabel);
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs font-normal opacity-70">{sublabel}</span>
            </button>
          );
        })}
      </div>

      {/* Weekly menu grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Menu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {DAYS.map(({ num, label }) => {
              const isToday = data.isCurrentWeek && todayDow === num;
              const slot1 = byDaySlot.get(`${num}-1`) ?? null;
              const slot2 = byDaySlot.get(`${num}-2`) ?? null;
              return (
                <div key={num} className={`space-y-1 ${isToday ? "ring-2 ring-primary rounded-lg p-2" : "p-2"}`}>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold">{label}</span>
                    {isToday && <Badge variant="secondary" className="text-[10px] px-1 py-0">Today</Badge>}
                  </div>
                  <MenuSlot weekLabel={data.weekLabel} day={num} slot={1} item={slot1} label="A" />
                  <MenuSlot weekLabel={data.weekLabel} day={num} slot={2} item={slot2} label="B" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Meal totals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Meal Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-1.5 font-medium">Day</th>
                  <th className="text-center px-3 py-1.5 font-medium">Option A</th>
                  <th className="text-center px-3 py-1.5 font-medium">Option B</th>
                  <th className="text-center px-3 py-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {DAYS.map(({ num, label }) => {
                  const slot1 = byDaySlot.get(`${num}-1`);
                  const slot2 = byDaySlot.get(`${num}-2`);
                  const countA = totals.get(`${num}-1`) || 0;
                  const countB = totals.get(`${num}-2`) || 0;
                  return (
                    <tr key={num}>
                      <td className="px-3 py-1.5 font-medium">{label}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="font-mono">{countA}</span>
                        {slot1 && <span className="text-xs text-muted-foreground ml-1">({slot1.name})</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="font-mono">{countB}</span>
                        {slot2 && <span className="text-xs text-muted-foreground ml-1">({slot2.name})</span>}
                      </td>
                      <td className="px-3 py-1.5 text-center font-bold">{countA + countB}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Kitchen notes summary */}
      <KitchenNotesSummary notes={data.notes} subDayNotes={data.subDayNotes} customerGroups={data.customerGroups} />

      {/* Customer meal selections */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Customer Meal Selections</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overlayCustomerId && (
            <CustomerOverlay
              customerId={overlayCustomerId}
              open={!!overlayCustomerId}
              onOpenChange={(o) => { if (!o) setOverlayCustomerId(null); }}
            />
          )}
          <MealSelectionGrid
            key={data.weekLabel}
            onCustomerClick={setOverlayCustomerId}
            weekLabel={data.weekLabel}
            weekMonday={data.weekMondayISO}
            customerGroups={data.customerGroups}
            menuItems={data.menuItems.map((i) => ({ day: i.day, slot: i.slot, name: i.name, goals: i.goals }))}
            selections={data.selections}
            notes={data.notes}
            subDayNotes={data.subDayNotes}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function KitchenNotesSummary({
  notes,
  subDayNotes,
  customerGroups,
}: {
  notes: { customerId: string; day: number; note: string }[];
  subDayNotes: { subscriptionId: string; day: number; note: string }[];
  customerGroups: CustomerGroup[];
}) {
  const todayNum = new Date().getDay(); // 0=Sun
  const defaultDay = todayNum >= 1 && todayNum <= 5 ? todayNum : 1;
  const [activeDay, setActiveDay] = useState(defaultDay);

  const hasAnyNote = notes.length > 0 || subDayNotes.length > 0;
  const dayKitchenNotes = notes.filter((n) => n.day === activeDay);
  const daySubNotes = subDayNotes.filter((n) => n.day === activeDay);

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Kitchen Notes</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {/* Day tabs */}
        <div className="flex gap-1 border-b mb-3">
          {DAYS.map(({ num, label }) => {
            const count = notes.filter((n) => n.day === num).length + subDayNotes.filter((n) => n.day === num).length;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setActiveDay(num)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px flex items-center gap-1 ${
                  activeDay === num
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[10px] ${
                    activeDay === num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {dayKitchenNotes.length === 0 && daySubNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasAnyNote ? "No notes for this day." : "No notes yet. Add them in the meal selections grid above."}
          </p>
        ) : (
          <div className="space-y-2">
            {daySubNotes.map((n) => {
              const group = customerGroups.find((g) =>
                g.subscriptions.some((s) => s.subscriptionId === n.subscriptionId)
              );
              const sub = group?.subscriptions.find((s) => s.subscriptionId === n.subscriptionId);
              const label = group
                ? group.subscriptions.length > 1
                  ? `${group.name} (${sub?.plan ?? ""})`
                  : group.name
                : n.subscriptionId;
              return (
                <div key={n.subscriptionId} className="flex gap-3 text-sm">
                  <span className="font-medium min-w-[120px] shrink-0 text-foreground">{label}</span>
                  <span className="text-muted-foreground whitespace-pre-wrap">{n.note}</span>
                </div>
              );
            })}
            {dayKitchenNotes.map((n) => {
              const group = customerGroups.find((g) => g.customerId === n.customerId);
              return (
                <div key={n.customerId} className="flex gap-3 text-sm">
                  <span className="font-medium min-w-[120px] shrink-0 text-foreground">{group?.name ?? n.customerId}</span>
                  <span className="text-muted-foreground whitespace-pre-wrap">{n.note}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
