import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getAllCustomers } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import {
  currentWeekLabel,
  currentWeekMonday,
  nextWeekLabel,
  nextWeekMonday,
  formatWeekLabel,
} from "@/lib/utils/week";
import { OpenInFinderButton } from "@/components/open-in-finder-button";
import { MenuTabs, type WeekData } from "./menu-tabs";

export const dynamic = "force-dynamic";

function buildWeekData(
  weekLabel: string,
  weekMonday: Date,
  isCurrentWeek: boolean,
  customers: ReturnType<typeof getAllCustomers>,
  subscriptions: ReturnType<typeof getAllSubscriptions>,
  allSkips: ReturnType<typeof getAllSkips>,
): WeekData {
  const items = getMenuItemsByWeek(weekLabel);
  const selections = getSelectionsByWeek(weekLabel);
  const weekNotes = getNotesByWeek(weekLabel);

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekMonday);
    d.setDate(weekMonday.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weekStart = weekDates[0];
  const weekEnd = weekDates[4];

  // Build one group per customer, with one SubRow per active subscription that overlaps the week
  const groupMap = new Map<string, WeekData["customerGroups"][number]>();

  for (const sub of subscriptions) {
    if (sub.status === "cancelled") continue;
    const subStart = new Date(sub.startDate); subStart.setHours(0, 0, 0, 0);
    const subEnd = new Date(sub.endDate); subEnd.setHours(0, 0, 0, 0);
    if (subStart > weekEnd || subEnd < weekStart) continue;

    const cust = customers.find((c) => c.phone === sub.customerId);
    if (!cust) continue;

    const subSkips = allSkips.filter((sk) => sk.subscriptionId === sub.id);
    const skips = weekDates
      .map((dayDate, i) => {
        const sk = subSkips.find((sk) => {
          const d = new Date(sk.originalDay);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === dayDate.getTime();
        });
        return sk ? { dayNum: i + 1, skipId: sk.id } : null;
      })
      .filter((s): s is { dayNum: number; skipId: string } => s !== null);

    const group = groupMap.get(cust.phone) ?? {
      customerId: cust.phone,
      name: cust.name,
      notes: cust.notes,
      subscriptions: [],
    };
    group.subscriptions.push({
      subscriptionId: sub.id,
      mealsPerDay: sub.mealsPerDay,
      goal: sub.goal,
      plan: sub.plan,
      startDate: sub.startDate,
      endDate: sub.endDate,
      skips,
    });
    groupMap.set(cust.phone, group);
  }

  return {
    weekLabel,
    weekMondayISO: weekMonday.toISOString(),
    formattedLabel: formatWeekLabel(weekLabel),
    isCurrentWeek,
    menuItems: items,
    notes: weekNotes.map((n) => ({ customerId: n.customerId, day: n.day, note: n.note })),
    selections: selections.map((s) => ({
      subscriptionId: s.subscriptionId,
      day: s.day,
      mealNum: s.mealNum,
      menuSlot: s.menuSlot,
    })),
    customerGroups: [...groupMap.values()],
  };
}

export default async function MenuPage() {
  const customers = getAllCustomers();
  const subscriptions = getAllSubscriptions();
  const allSkips = getAllSkips();

  const thisWeek = buildWeekData(
    currentWeekLabel(),
    currentWeekMonday(),
    true,
    customers,
    subscriptions,
    allSkips,
  );
  const nextWeek = buildWeekData(
    nextWeekLabel(),
    nextWeekMonday(),
    false,
    customers,
    subscriptions,
    allSkips,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu</h1>
        <OpenInFinderButton file="menu.xlsx" />
      </div>
      <MenuTabs thisWeek={thisWeek} nextWeek={nextWeek} />
    </div>
  );
}
