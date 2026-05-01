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
import { isSubscriptionLive } from "@/lib/utils/subscription";
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

  const activeCustomers = subscriptions
    .filter((s) => isSubscriptionLive(s.status, s.renewalDate))
    .map((sub) => {
      const cust = customers.find((c) => c.phone === sub.customerId);
      if (!cust) return null;

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

      return {
        id: cust.phone,
        name: cust.name,
        mealsPerDay: sub.mealsPerDay,
        goal: sub.goal,
        startDate: sub.startDate,
        endDate: sub.renewalDate,
        subscriptionId: sub.id,
        skips,
      };
    })
    .filter(Boolean) as WeekData["activeCustomers"];

  return {
    weekLabel,
    weekMondayISO: weekMonday.toISOString(),
    formattedLabel: formatWeekLabel(weekLabel),
    isCurrentWeek,
    menuItems: items,
    notes: weekNotes.map((n) => ({ customerId: n.customerId, day: n.day, note: n.note })),
    selections: selections.map((s) => ({
      customerId: s.customerId,
      day: s.day,
      mealNum: s.mealNum,
      menuSlot: s.menuSlot,
    })),
    activeCustomers,
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
