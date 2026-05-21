import { getAllSubscriptions, getAllExtras, getAllSkips } from "@/lib/data/subscriptions";
import { getAllPayments } from "@/lib/data/payments";
import { getAllCreditTransactions } from "@/lib/data/credits";
import { getAllCostItems } from "@/lib/data/cost-items";
import { getAllCostCategories } from "@/lib/data/cost-categories";
import { getAllWeeklyOps } from "@/lib/data/operations";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { weekLabelForDate, weekLabelToMonday } from "@/lib/utils/week";
import { earnedRevenueInRange, deferredRevenue } from "@/lib/utils/revenue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportsCharts } from "./reports-charts";
import { TrendChart, CategoryDonut } from "@/app/costs/cost-charts";
import type { WeekSummary } from "@/app/costs/cost-types";

export const dynamic = "force-dynamic";

function lastNWeekLabels(n: number): string[] {
  const labels: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(d);
    date.setDate(d.getDate() - i * 7);
    labels.push(weekLabelForDate(date));
  }
  return [...new Set(labels)];
}

export default async function ReportsPage() {
  const subscriptions = getAllSubscriptions();
  const knownSubIds = new Set(subscriptions.map((s) => s.id));
  const allPayments = getAllPayments().filter((p) => knownSubIds.has(p.subscriptionId));
  const allCreditTransactions = getAllCreditTransactions();
  const allExtras = getAllExtras();
  const allSkips = getAllSkips();
  const allCostItems = getAllCostItems();
  const categories = getAllCostCategories();
  const allOps = getAllWeeklyOps();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // ── Active subscription stats ────────────────────────────────────────────────
  const activeSubs = subscriptions.filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate));
  const totalActiveSubs = activeSubs.length;
  const totalARR = activeSubs.reduce((s, sub) => s + sub.subscriptionPrice + sub.shippingPrice - sub.discount, 0);

  // All-time payments collected (net, cash-basis)
  const totalPaymentsCollected = allPayments.reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
  const totalCostAll = allCostItems.reduce((s, i) => s + i.amount, 0);

  // All-time recognized revenue (accrual: earned as meals delivered, up to today)
  const totalEarned = subscriptions.reduce(
    (s, sub) => s + earnedRevenueInRange(sub, allSkips, allExtras, new Date(sub.startDate), today),
    0
  );

  // Deferred revenue: prepaid but not yet delivered across all active subs
  const totalDeferred = subscriptions
    .filter((s) => s.status !== "cancelled")
    .reduce(
      (s, sub) => s + deferredRevenue(sub, allPayments, allCreditTransactions, allSkips, allExtras, today),
      0
    );

  // ── Per-goal breakdown (active subs, recognized revenue all-time) ───────────
  const GOALS = ["cutting", "maintenance", "bulking", "keto"];
  const goalBreakdown = GOALS.map((goal) => {
    const subs = activeSubs.filter((s) => s.goal === goal);
    const revenue = subs.reduce(
      (s, sub) => s + earnedRevenueInRange(sub, allSkips, allExtras, new Date(sub.startDate), today),
      0
    );
    return {
      goal: goal.charAt(0).toUpperCase() + goal.slice(1),
      subs: subs.length,
      revenue: Math.round(revenue),
    };
  }).filter((g) => g.subs > 0 || g.revenue > 0);

  // ── Weekly trend data (last 8 weeks) ─────────────────────────────────────────
  const weeks = lastNWeekLabels(8);

  function weekDateRange(label: string): { from: Date; to: Date } {
    const from = weekLabelToMonday(label);
    const to = new Date(from);
    to.setDate(from.getDate() + 4); // Friday
    return { from, to };
  }

  function weekPaymentsCollected(label: string): number {
    return allPayments
      .filter((p) => weekLabelForDate(new Date(p.paidAt)) === label)
      .reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
  }

  function weekEarnedRevenue(label: string): number {
    const { from, to } = weekDateRange(label);
    return subscriptions.reduce(
      (s, sub) => s + earnedRevenueInRange(sub, allSkips, allExtras, from, to),
      0
    );
  }

  const weeklyRevenue = weeks.map((week) => {
    const recognized = weekEarnedRevenue(week);
    const collected = weekPaymentsCollected(week);
    const cost = allCostItems.filter((i) => i.weekLabel === week).reduce((s, i) => s + i.amount, 0);
    return {
      week: week.split("-")[1] ?? week,
      revenue: Math.round(recognized),
      collected: Math.round(collected),
      cost: Math.round(cost),
    };
  });

  const weeklyMargin = weeks.map((week) => {
    const recognized = weekEarnedRevenue(week);
    const cost = allCostItems.filter((i) => i.weekLabel === week).reduce((s, i) => s + i.amount, 0);
    const margin = recognized > 0 ? Math.round(((recognized - cost) / recognized) * 100) : 0;
    return { week: week.split("-")[1] ?? week, margin };
  });

  // ── Cost by category (last 4 weeks) ──────────────────────────────────────────
  const last4Weeks = lastNWeekLabels(4);
  const costByCategoryMap = new Map<string, number>();
  for (const item of allCostItems) {
    if (last4Weeks.includes(item.weekLabel)) {
      const name = catMap.get(item.categoryId) ?? "Other";
      costByCategoryMap.set(name, (costByCategoryMap.get(name) ?? 0) + item.amount);
    }
  }
  const costByCategory = Array.from(costByCategoryMap.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  // ── Waste rate trend ──────────────────────────────────────────────────────────
  const weeklyWaste = weeks.map((week) => {
    const ops = allOps.find((o) => o.weekLabel === week);
    const rate = ops && ops.mealsPrepared > 0
      ? parseFloat(((ops.wastedMeals / ops.mealsPrepared) * 100).toFixed(1))
      : 0;
    return { week: week.split("-")[1] ?? week, rate };
  });

  // ── Summary stats ────────────────────────────────────────────────────────────
  const allTimeMargin = totalEarned > 0
    ? Math.round(((totalEarned - totalCostAll) / totalEarned) * 100)
    : null;

  // ── P&L summary: all-time / this month / this week ───────────────────────────
  const thisWeekLabel = weekLabelForDate(today);
  const thisWeekEarned = weekEarnedRevenue(thisWeekLabel);
  const thisWeekCost = allCostItems.filter((i) => i.weekLabel === thisWeekLabel).reduce((s, i) => s + i.amount, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const thisMonthEarned = subscriptions.reduce(
    (s, sub) => s + earnedRevenueInRange(sub, allSkips, allExtras, monthStart, monthEnd),
    0
  );
  const thisMonthCost = allCostItems.filter((i) => {
    const mon = weekLabelToMonday(i.weekLabel);
    return mon >= monthStart && mon <= monthEnd;
  }).reduce((s, i) => s + i.amount, 0);

  // ── Cost summaries for TrendChart + CategoryDonut ────────────────────────────
  const allCostWeeks = [...new Set(allCostItems.map((i) => i.weekLabel))].sort();
  const costSummaries: WeekSummary[] = allCostWeeks.map((wl) => {
    const monday = weekLabelToMonday(wl);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const weekItems = allCostItems.filter((i) => i.weekLabel === wl);
    const totalCost = weekItems.reduce((s, i) => s + i.amount, 0);
    const weekOps = allOps.find((o) => o.weekLabel === wl);
    const mealsDelivered = weekOps?.mealsDelivered ?? 0;
    const revenue = Math.round(
      subscriptions.reduce((s, sub) => s + earnedRevenueInRange(sub, allSkips, allExtras, monday, friday), 0)
    );
    return {
      weekLabel: wl,
      dateRange: "",
      totalCost,
      mealsDelivered,
      costPerMeal: mealsDelivered > 0 ? Math.round(totalCost / mealsDelivered) : null,
      revenue,
      profit: revenue - totalCost,
    };
  });

  const pnlRows = [
    { label: "All time",   revenue: totalEarned,      cost: totalCostAll,    profit: totalEarned - totalCostAll },
    { label: "This month", revenue: thisMonthEarned,  cost: thisMonthCost,   profit: thisMonthEarned - thisMonthCost },
    { label: "This week",  revenue: thisWeekEarned,   cost: thisWeekCost,    profit: thisWeekEarned - thisWeekCost },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Financial and operational deep-dive</p>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Subs</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalActiveSubs}</p>
            <p className="text-xs text-muted-foreground mt-1">
              MRR est. {totalARR.toLocaleString()} VND
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recognized Revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalEarned.toLocaleString()} VND</p>
            <p className="text-xs text-muted-foreground mt-1">
              Payments collected: {totalPaymentsCollected.toLocaleString()} VND
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deferred Revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{totalDeferred.toLocaleString()} VND</p>
            <p className="text-xs text-muted-foreground mt-1">prepaid, not yet delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All-time Margin</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-3xl font-bold ${allTimeMargin !== null && allTimeMargin < 20 ? "text-red-600" : ""}`}>
              {allTimeMargin !== null ? `${allTimeMargin}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cost: {totalCostAll.toLocaleString()} VND · {allCostItems.length} entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Summary */}
      <Card>
        <CardHeader>
          <CardTitle>P&amp;L Summary</CardTitle>
          <CardDescription>Recognized revenue vs. cost — accrual basis</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium">Period</th>
                <th className="text-right px-4 py-2 font-medium">Revenue</th>
                <th className="text-right px-4 py-2 font-medium">Cost</th>
                <th className="text-right px-4 py-2 font-medium">Net Profit</th>
                <th className="text-right px-4 py-2 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pnlRows.map((row) => {
                const margin = row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : null;
                return (
                  <tr key={row.label} className="hover:bg-accent/50">
                    <td className="px-4 py-2 font-medium">{row.label}</td>
                    <td className="px-4 py-2 text-right">{row.revenue.toLocaleString()} VND</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{row.cost.toLocaleString()} VND</td>
                    <td className={`px-4 py-2 text-right font-semibold ${row.profit < 0 ? "text-red-600" : "text-green-600"}`}>
                      {row.profit >= 0 ? "+" : ""}{row.profit.toLocaleString()} VND
                    </td>
                    <td className={`px-4 py-2 text-right ${margin !== null && margin < 20 ? "text-red-600" : "text-muted-foreground"}`}>
                      {margin !== null ? `${margin}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
          <CardDescription>Recognized revenue (accrual) vs. costs — last 8 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportsCharts
            weeklyRevenue={weeklyRevenue}
            weeklyMargin={weeklyMargin}
            goalBreakdown={goalBreakdown}
            costByCategory={costByCategory}
            weeklyWaste={weeklyWaste}
          />
        </CardContent>
      </Card>

      {/* Cost Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Analysis</CardTitle>
          <CardDescription>Weekly cost trend and all-time category breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 divide-x">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Cost Trend</p>
              <TrendChart summaries={costSummaries} />
            </div>
            <div className="pl-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">All-time by Category</p>
              <CategoryDonut items={allCostItems} categories={categories} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-goal table */}
      {goalBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Goal Summary (Active Subs)</CardTitle>
            <CardDescription>Recognized revenue earned to date</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Goal</th>
                  <th className="text-right px-4 py-2 font-medium">Subs</th>
                  <th className="text-right px-4 py-2 font-medium">Earned (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {goalBreakdown.map((g) => (
                  <tr key={g.goal} className="hover:bg-accent/50">
                    <td className="px-4 py-2">{g.goal}</td>
                    <td className="px-4 py-2 text-right">{g.subs}</td>
                    <td className="px-4 py-2 text-right">{g.revenue.toLocaleString()} VND</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
