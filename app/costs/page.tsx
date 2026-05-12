import { getAllCostCategories } from "@/lib/data/cost-categories";
import { getCostItemsByWeek } from "@/lib/data/cost-items";
import { getWeeklyOpsByLabel } from "@/lib/data/operations";
import { currentWeekLabel, weekLabelToDateRange } from "@/lib/utils/week";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CostsPanel } from "./costs-panel";

export const dynamic = "force-dynamic";

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekLabel = params.week ?? currentWeekLabel();
  const dateRange = weekLabelToDateRange(weekLabel);

  const categories = getAllCostCategories();
  const items = getCostItemsByWeek(weekLabel);
  const ops = getWeeklyOpsByLabel(weekLabel);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Weekly Costs</h1>
          <p className="text-sm text-muted-foreground">{weekLabel} · {dateRange}</p>
        </div>
        <WeekNavigator current={weekLabel} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{weekLabel}</CardTitle>
          <CardDescription>{dateRange}</CardDescription>
        </CardHeader>
        <CardContent>
          <CostsPanel
            weekLabel={weekLabel}
            categories={categories}
            initialItems={items}
            initialOps={ops}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function WeekNavigator({ current }: { current: string }) {
  // Parse current week to compute prev/next
  const [yearStr, weekPart] = current.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(weekPart);

  function makeLabel(y: number, w: number): string {
    // Handle year rollover
    const daysInYear = isLeap(y) ? 366 : 365;
    const weeksInYear = Math.ceil(daysInYear / 7);
    if (w < 1) return `${y - 1}-W${String(Math.ceil((isLeap(y - 1) ? 366 : 365) / 7)).padStart(2, "0")}`;
    if (w > weeksInYear) return `${y + 1}-W01`;
    return `${y}-W${String(w).padStart(2, "0")}`;
  }

  function isLeap(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  const prev = makeLabel(year, week - 1);
  const next = makeLabel(year, week + 1);

  return (
    <div className="flex items-center gap-2">
      <a href={`/costs?week=${prev}`}
        className="px-3 py-1.5 text-sm border rounded hover:bg-accent transition-colors">
        ← Prev
      </a>
      <a href="/costs" className="px-3 py-1.5 text-sm border rounded hover:bg-accent transition-colors">
        This week
      </a>
      <a href={`/costs?week=${next}`}
        className="px-3 py-1.5 text-sm border rounded hover:bg-accent transition-colors">
        Next →
      </a>
    </div>
  );
}
