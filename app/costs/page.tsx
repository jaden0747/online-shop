import { getAllCostCategories } from "@/lib/data/cost-categories";
import { getCostItemsByWeek } from "@/lib/data/cost-items";
import { getWeeklyOpsByLabel } from "@/lib/data/operations";
import { currentWeekLabel, weekLabelToDateRange, shiftWeekLabel } from "@/lib/utils/week";
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
  const prev = shiftWeekLabel(current, -1);
  const next = shiftWeekLabel(current, 1);

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
