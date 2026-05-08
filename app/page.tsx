import Link from "next/link";
import { getAllCustomers } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { isSubscriptionLive, daysRemaining, isTodayWeekday } from "@/lib/utils/subscription";
import { currentWeekLabel, currentWeekMonday } from "@/lib/utils/week";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    isSubscriptionLive(s.status, s.startDate, s.renewalDate)
  );

  const todayDeliveryCount = todayIsWeekday ? activeSubs.length : 0;

  // Expiring soon: active subs with renewalDate within 7 days
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const expiringSoon = activeSubs
    .map((s) => {
      const renewal = new Date(s.renewalDate);
      renewal.setHours(0, 0, 0, 0);
      const days = daysRemaining(s.renewalDate);
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
      if (isSubscriptionLive(s.status, s.startDate, s.renewalDate, d)) {
        thisWeekSubIds.add(s.id);
        break;
      }
    }
  }

  // Kitchen prep: top 3 meal options this week
  const selections = getSelectionsByWeek(weekLabel);
  const menuItems = getMenuItemsByWeek(weekLabel);

  const slotCounts = new Map<number, number>();
  for (const sel of selections) {
    slotCounts.set(sel.menuSlot, (slotCounts.get(sel.menuSlot) ?? 0) + 1);
  }
  const topMeals = Array.from(slotCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slot, count]) => {
      const item = menuItems.find((m) => m.slot === slot);
      return { name: item?.name ?? `Option ${slot}`, count };
    });

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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="text-primary shrink-0">
          <path d="M14 26 C14 26 6 20 6 12 C6 7.58 9.58 4 14 4 C18.42 4 22 7.58 22 12 C22 20 14 26 14 26Z" fill="currentColor" opacity="0.18"/>
          <path d="M14 26 C14 26 10 18 14 10 C16 6 20 5 22 8 C24 11 22 16 14 26Z" fill="currentColor" opacity="0.35"/>
          <line x1="14" y1="26" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Oli Healthy</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-bold">
              {todayIsWeekday ? `${todayDeliveryCount} deliveries today` : "No deliveries today"}
            </span>
            <Link
              href="/shipping"
              className="text-sm font-medium underline-offset-4 hover:underline text-muted-foreground"
            >
              View Shipping →
            </Link>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{activeSubs.length} active</span>
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader>
            <CardTitle>Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringSoon.length === 0 ? (
              <p className="text-muted-foreground text-sm">None expiring soon</p>
            ) : (
              <ul className="space-y-2">
                {expiringSoon.map(({ sub, days }) => {
                  const customer = customerMap.get(sub.customerId);
                  return (
                    <li key={sub.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{customer?.name ?? sub.customerId}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(sub.renewalDate).toLocaleDateString("en-GB")}
                      </span>
                      <span className={`font-semibold ${expiryColor(days)}`}>
                        {days === 0 ? "today" : `${days}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* This Week's Orders */}
        <Card>
          <CardHeader>
            <CardTitle>This Week&apos;s Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-3xl font-bold">{thisWeekSubIds.size} this week</span>
            <Link
              href="/menu"
              className="text-sm font-medium underline-offset-4 hover:underline text-muted-foreground"
            >
              View Menu →
            </Link>
          </CardContent>
        </Card>

        {/* Kitchen Prep Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Kitchen Prep Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {topMeals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No selections yet</p>
            ) : (
              <ul className="space-y-2">
                {topMeals.map(({ name, count }) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{name}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCustomers.length === 0 ? (
              <p className="text-muted-foreground text-sm">No customers yet</p>
            ) : (
              <ul className="space-y-2">
                {recentCustomers.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.phone}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(c.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
