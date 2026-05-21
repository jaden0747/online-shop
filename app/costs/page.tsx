import { getAllCostCategories } from "@/lib/data/cost-categories";
import { getCostItemsByWeek, getAllCostItems } from "@/lib/data/cost-items";
import { getWeeklyOpsByLabel, getAllWeeklyOps } from "@/lib/data/operations";
import { getAllSubscriptions, getAllSkips, getAllExtras } from "@/lib/data/subscriptions";
import { currentWeekLabel, weekLabelToDateRange, weekLabelToMonday, shiftWeekLabel } from "@/lib/utils/week";
import { earnedRevenueInRange } from "@/lib/utils/revenue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CostsPanel } from "./costs-panel";
import type { WeekSummary } from "./cost-types";

export const dynamic = "force-dynamic";

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekLabel = params.week ?? currentWeekLabel();
  const dateRange = weekLabelToDateRange(weekLabel);
  const prev = shiftWeekLabel(weekLabel, -1);
  const next = shiftWeekLabel(weekLabel, 1);

  const categories = getAllCostCategories();
  const items = getCostItemsByWeek(weekLabel);
  const ops = getWeeklyOpsByLabel(weekLabel);

  // Data for overview + charts
  const allItems = getAllCostItems();
  const allOps = getAllWeeklyOps();
  const allSubs = getAllSubscriptions();
  const allSkips = getAllSkips();
  const allExtras = getAllExtras();

  const weeks = [...new Set(allItems.map((i) => i.weekLabel))].sort().reverse();

  const summaries: WeekSummary[] = weeks.map((wl) => {
    const monday = weekLabelToMonday(wl);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const weekItems = allItems.filter((i) => i.weekLabel === wl);
    const totalCost = weekItems.reduce((s, i) => s + i.amount, 0);
    const weekOps = allOps.find((o) => o.weekLabel === wl);
    const mealsDelivered = weekOps?.mealsDelivered ?? 0;
    const revenue = Math.round(
      allSubs.reduce((s, sub) => s + earnedRevenueInRange(sub, allSkips, allExtras, monday, friday), 0)
    );
    return {
      weekLabel: wl,
      dateRange: weekLabelToDateRange(wl),
      totalCost,
      mealsDelivered,
      costPerMeal: mealsDelivered > 0 ? Math.round(totalCost / mealsDelivered) : null,
      revenue,
      profit: revenue - totalCost,
    };
  });

  const currentSummary = summaries.find((s) => s.weekLabel === weekLabel);
  const shippingCategoryId = categories.find((c) => c.name === "Shipping")?.id ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Weekly Costs</h1>
          <p className="text-sm text-muted-foreground">{weekLabel} · {dateRange}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <a href={`/costs?week=${prev}`}
            className="px-2.5 py-0.5 text-xs border rounded hover:bg-accent transition-colors">
            ← Prev
          </a>
          <a href="/costs"
            className="px-2.5 py-0.5 text-xs border rounded hover:bg-accent transition-colors">
            Today
          </a>
          <a href={`/costs?week=${next}`}
            className="px-2.5 py-0.5 text-xs border rounded hover:bg-accent transition-colors">
            Next →
          </a>
        </div>
      </div>

      {/* Main feature — week detail & add cost */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{weekLabel}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{dateRange}</span>
            {currentSummary?.costPerMeal && (
              <span className="font-medium text-foreground">
                Cost/meal: {currentSummary.costPerMeal.toLocaleString()} ₫
              </span>
            )}
            {currentSummary && currentSummary.revenue > 0 && (
              <span
                className={
                  currentSummary.profit >= 0
                    ? "text-green-600 dark:text-green-400 font-medium"
                    : "text-red-500 font-medium"
                }
              >
                Profit: {currentSummary.profit >= 0 ? "+" : ""}
                {currentSummary.profit.toLocaleString()} ₫
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CostsPanel
            weekLabel={weekLabel}
            categories={categories}
            initialItems={items}
            initialOps={ops}
            shippingCategoryId={shippingCategoryId}
            summaries={summaries}
          />
        </CardContent>
      </Card>
    </div>
  );
}
