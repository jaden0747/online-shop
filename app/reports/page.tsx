import { getAllSubscriptions, getAllExtras } from "@/lib/data/subscriptions";
import { getAllPayments } from "@/lib/data/payments";
import { getAllCostItems } from "@/lib/data/cost-items";
import { getAllCostCategories } from "@/lib/data/cost-categories";
import { getAllWeeklyOps } from "@/lib/data/operations";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { weekLabelForDate } from "@/lib/utils/week";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReportsCharts } from "./reports-charts";

export const dynamic = "force-dynamic";

function lastNWeekLabels(n: number): string[] {
  const labels: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(d);
    date.setDate(d.getDate() - i * 7);
    labels.push(weekLabelForDate(date));
  }
  // deduplicate
  return [...new Set(labels)];
}

export default async function ReportsPage() {
  const subscriptions = getAllSubscriptions();
  const allPayments = getAllPayments();
  const allExtras = getAllExtras();
  const allCostItems = getAllCostItems();
  const categories = getAllCostCategories();
  const allOps = getAllWeeklyOps();

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // ── Active subscription stats ────────────────────────────────────────────────
  const today = new Date();
  const activeSubs = subscriptions.filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate));
  const totalActiveSubs = activeSubs.length;
  const totalARR = activeSubs.reduce((s, sub) => s + sub.subscriptionPrice + sub.shippingPrice - sub.discount, 0);

  // All-time revenue (net payments)
  const totalRevenue = allPayments.reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
  const totalCostAll = allCostItems.reduce((s, i) => s + i.amount, 0);

  // ── Per-goal breakdown ───────────────────────────────────────────────────────
  const GOALS = ["cutting", "maintenance", "bulking", "keto"];
  const goalBreakdown = GOALS.map((goal) => {
    const subs = activeSubs.filter((s) => s.goal === goal);
    const subIds = new Set(subs.map((s) => s.id));
    const revenue = allPayments
      .filter((p) => subIds.has(p.subscriptionId))
      .reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
    return {
      goal: goal.charAt(0).toUpperCase() + goal.slice(1),
      subs: subs.length,
      revenue: Math.round(revenue / 1000), // in k₫
    };
  }).filter((g) => g.subs > 0 || g.revenue > 0);

  // ── Weekly trend data (last 8 weeks) ──────────────────────────────────────────
  const weeks = lastNWeekLabels(8);

  function weekPaymentsNet(weekLabel: string): number {
    // find sub IDs active during this week
    return allPayments
      .filter((p) => {
        // use createdAt week label as proxy for when payment was made
        return weekLabelForDate(new Date(p.paidAt)) === weekLabel;
      })
      .reduce((s, p) => s + (p.type === "payment" ? p.amount : -p.amount), 0);
  }

  const weeklyRevenue = weeks.map((week) => {
    const revenue = weekPaymentsNet(week);
    const cost = allCostItems.filter((i) => i.weekLabel === week).reduce((s, i) => s + i.amount, 0);
    return {
      week: week.split("-")[1] ?? week, // "W21" display
      revenue: Math.round(revenue / 1000),
      cost: Math.round(cost / 1000),
    };
  });

  const weeklyMargin = weeks.map((week) => {
    const revenue = weekPaymentsNet(week);
    const cost = allCostItems.filter((i) => i.weekLabel === week).reduce((s, i) => s + i.amount, 0);
    const margin = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 100) : 0;
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
  const allTimeMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalCostAll) / totalRevenue) * 100) : null;

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
              MRR est. ₫{(totalARR / 1000).toFixed(0)}k
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All-time Revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">₫{(totalRevenue / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-muted-foreground mt-1">{allPayments.filter(p => p.type === "payment").length} payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All-time Cost</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">₫{(totalCostAll / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-muted-foreground mt-1">{allCostItems.length} cost entries</p>
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
              {totalRevenue > 0 && totalCostAll > 0 ? `₫${((totalRevenue - totalCostAll) / 1000000).toFixed(1)}M profit` : "No data"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle>Trends</CardTitle>
          <CardDescription>Showing last 8 weeks of data</CardDescription>
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

      {/* Per-goal table */}
      {goalBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Goal Summary (Active Subs)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Goal</th>
                  <th className="text-right px-4 py-2 font-medium">Subs</th>
                  <th className="text-right px-4 py-2 font-medium">Revenue (k₫)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {goalBreakdown.map((g) => (
                  <tr key={g.goal} className="hover:bg-accent/50">
                    <td className="px-4 py-2">{g.goal}</td>
                    <td className="px-4 py-2 text-right">{g.subs}</td>
                    <td className="px-4 py-2 text-right">₫{g.revenue.toLocaleString()}k</td>
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
