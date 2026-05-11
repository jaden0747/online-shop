import Link from "next/link";
import { getAllCustomers } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { isSubscriptionLive, daysRemaining, isTodayWeekday } from "@/lib/utils/subscription";
import { currentWeekLabel, currentWeekMonday } from "@/lib/utils/week";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCharts } from "./dashboard-charts";
import { CustomerNameButton } from "./customer-name-button";
import { AppVersionBadge } from "@/components/app-version-badge";
import { AppUpdateStatus } from "@/components/update-status";
import { OpenInFinderButton } from "@/components/open-in-finder-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const customers = getAllCustomers();
  const subscriptions = getAllSubscriptions();
  const weekLabel = currentWeekLabel();
  const monday = currentWeekMonday();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIsWeekday = isTodayWeekday();

  // Active subscriptions (live today)
  const activeSubs = subscriptions.filter((s) =>
    isSubscriptionLive(s.status, s.startDate, s.endDate)
  );

  const todayDeliveryCount = todayIsWeekday ? activeSubs.length : 0;

  // Expiring soon: active subs with endDate within 7 days
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const expiringSoon = activeSubs
    .map((s) => {
      const renewal = new Date(s.endDate);
      renewal.setHours(0, 0, 0, 0);
      const days = daysRemaining(s.endDate);
      return { sub: s, days, renewal };
    })
    .filter(({ renewal }) => renewal <= sevenDaysFromNow)
    .sort((a, b) => a.days - b.days);

  // This week's active orders: subs live on any weekday this week
  const weekDates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  const thisWeekSubIds = new Set<string>();
  for (const s of subscriptions) {
    for (const d of weekDates) {
      if (isSubscriptionLive(s.status, s.startDate, s.endDate, d)) {
        thisWeekSubIds.add(s.id);
        break;
      }
    }
  }

  // Kitchen prep: top 3 meal options this week
  const selections = getSelectionsByWeek(weekLabel);
  const menuItems = getMenuItemsByWeek(weekLabel);

  const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  // Per (day × slot) selection counts — correct name lookup
  const mealSelectionsPerDay = DAY_NAMES_SHORT.flatMap((dayLabel, i) =>
    [1, 2].map((slot) => {
      const day = i + 1;
      const count = selections.filter((s) => s.day === day && s.menuSlot === slot).length;
      const item = menuItems.find((m) => m.day === day && m.slot === slot);
      return { name: `${dayLabel} · ${item?.name ?? `Option ${slot}`}`, count, day };
    })
  );

  // Top meal by highest single (day × slot) count
  const topMealEntry = [...mealSelectionsPerDay].sort((a, b) => b.count - a.count)[0];
  const topMeals = topMealEntry ? [topMealEntry] : [];

  // Total meals to prepare this week (mealsPerDay × active delivery days, no skips factored)
  let totalMealsThisWeek = 0;
  for (const d of weekDates) {
    for (const s of subscriptions) {
      if (isSubscriptionLive(s.status, s.startDate, s.endDate, d)) {
        totalMealsThisWeek += s.mealsPerDay;
      }
    }
  }

  // ── Chart data ──────────────────────────────────────────────────────────────

  // Chart 1: Subscription mix by plan and goal
  const planCounts = new Map<string, number>();
  const goalCounts = new Map<string, number>();
  for (const s of activeSubs) {
    planCounts.set(s.plan, (planCounts.get(s.plan) ?? 0) + 1);
    goalCounts.set(s.goal, (goalCounts.get(s.goal) ?? 0) + 1);
  }
  const planMix = Array.from(planCounts.entries()).map(([name, value]) => ({ name, value }));
  const goalMix = Array.from(goalCounts.entries()).map(([name, value]) => ({ name, value }));

  // Chart 2: Deliveries per weekday this week
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekdayDeliveries = weekDates.map((d, i) => ({
    day: DAY_NAMES[i],
    count: subscriptions.filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate, d)).length,
  }));

  // Chart 3: All meal selections this week (per day × slot)
  const mealSelections = mealSelectionsPerDay;

  // Chart 4: Active customers by zone
  const activeCustomerPhones = new Set(activeSubs.map((s) => s.customerId));
  const zoneCounts = new Map<string, number>();
  for (const c of customers) {
    if (activeCustomerPhones.has(c.phone)) {
      const z = c.zone?.trim() || "Unknown";
      zoneCounts.set(z, (zoneCounts.get(z) ?? 0) + 1);
    }
  }
  const zoneData = Array.from(zoneCounts.entries())
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => b.count - a.count);

  // Chart 5: Renewal timeline buckets
  const renewalBuckets = [
    { bucket: "0-2d", min: -Infinity, max: 2 },
    { bucket: "3-7d", min: 3, max: 7 },
    { bucket: "8-14d", min: 8, max: 14 },
    { bucket: "15-30d", min: 15, max: 30 },
    { bucket: "30d+", min: 31, max: Infinity },
  ];
  const renewalData = renewalBuckets.map(({ bucket, min, max }) => ({
    bucket,
    count: activeSubs.filter((s) => {
      const d = daysRemaining(s.endDate);
      return d >= min && d <= max;
    }).length,
  }));

  // Chart 6: Meals-per-day distribution
  const mpdCounts = new Map<number, number>();
  for (const s of activeSubs) {
    mpdCounts.set(s.mealsPerDay, (mpdCounts.get(s.mealsPerDay) ?? 0) + 1);
  }
  const mealsPerDayData = Array.from(mpdCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([meals, count]) => ({ meals: `${meals} meal${meals > 1 ? "s" : ""}`, count }));

  // Recent customers: last 7 by createdAt
  const recentCustomers = [...customers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 7);

  // Customer name lookup
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  function expiryColor(days: number): string {
    if (days <= 2) return "text-red-600";
    if (days <= 6) return "text-orange-500";
    if (days <= 13) return "text-yellow-600";
    return "text-green-600";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="text-primary shrink-0">
          <path d="M14 26 C14 26 6 20 6 12 C6 7.58 9.58 4 14 4 C18.42 4 22 7.58 22 12 C22 20 14 26 14 26Z" fill="currentColor" opacity="0.18"/>
          <path d="M14 26 C14 26 10 18 14 10 C16 6 20 5 22 8 C24 11 22 16 14 26Z" fill="currentColor" opacity="0.35"/>
          <line x1="14" y1="26" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Oli Healthy</h1>
      </div>

      {/* ── Version + update status ── */}
      <div className="flex items-center gap-2">
        <AppVersionBadge />
        <AppUpdateStatus />
        <OpenInFinderButton file="customers.xlsx" label="Open Data Folder" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Deliveries */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Today&apos;s Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{todayIsWeekday ? todayDeliveryCount : "—"}</p>
            <Link href="/shipping" className="text-xs text-muted-foreground hover:underline underline-offset-2 mt-1 inline-block">
              View Shipping →
            </Link>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Subs</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{activeSubs.length}</p>
            <p className="text-xs text-muted-foreground mt-1">subscriptions live</p>
          </CardContent>
        </Card>

        {/* This Week */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{thisWeekSubIds.size}</p>
            <Link href="/menu" className="text-xs text-muted-foreground hover:underline underline-offset-2 mt-1 inline-block">
              View Menu →
            </Link>
          </CardContent>
        </Card>

        {/* Kitchen Top Meal */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Meal Today</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {topMeals[0] ? (
              <>
                <p className="text-sm font-semibold leading-tight truncate">{topMeals[0].name}</p>
                <p className="text-2xl font-bold mt-0.5">{topMeals[0].count}<span className="text-base font-normal text-muted-foreground ml-1">orders</span></p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No selections yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Expiring Soon + Recent Customers (2+2 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Expiring Soon */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringSoon.length === 0 ? (
              <p className="text-muted-foreground text-sm">None expiring soon</p>
            ) : (
              <ul className="divide-y">
                {expiringSoon.map(({ sub, days }) => {
                  const customer = customerMap.get(sub.customerId);
                  return (
                    <li key={sub.id} className="grid grid-cols-[1fr_auto_auto] items-center py-1.5 text-sm gap-x-3">
                      <CustomerNameButton
                        customerId={sub.customerId}
                        name={customer?.name ?? sub.customerId}
                      />
                      <span className="text-muted-foreground text-xs text-right tabular-nums">
                        {new Date(sub.endDate).toLocaleDateString("en-GB")}
                      </span>
                      <span className={`font-semibold text-xs text-right tabular-nums w-10 ${expiryColor(days)}`}>
                        {days === 0 ? "today" : `${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Customers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCustomers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No customers yet</p>
            ) : (
              <ul className="divide-y">
                {recentCustomers.map((c) => (
                  <li key={c.id} className="grid grid-cols-[1fr_auto_auto] items-center py-1.5 text-sm gap-x-3">
                    <CustomerNameButton customerId={c.id} name={c.name} />
                    <span className="text-muted-foreground text-xs text-right tabular-nums">{c.phone}</span>
                    <span className="text-muted-foreground text-xs text-right tabular-nums w-20">
                      {new Date(c.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3+: Charts ── */}
      <DashboardCharts
        planMix={planMix}
        goalMix={goalMix}
        weekdayDeliveries={weekdayDeliveries}
        mealSelections={mealSelections}
        zoneData={zoneData}
        renewalData={renewalData}
        mealsPerDayData={mealsPerDayData}
        totalMealsThisWeek={totalMealsThisWeek}
      />
    </div>
  );
}
