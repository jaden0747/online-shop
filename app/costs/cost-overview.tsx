"use client";

import type { WeekSummary } from "./cost-types";

function fmtK(n: number): string {
  if (n === 0) return "—";
  return `${(n / 1000).toFixed(0)}K`;
}

export function CostOverview({
  summaries,
  currentWeek,
}: {
  summaries: WeekSummary[];
  currentWeek: string;
}) {
  if (summaries.length === 0) {
    return <p className="text-xs text-muted-foreground py-2 text-center">No data</p>;
  }

  return (
    <div className="overflow-y-auto max-h-[180px] overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1 pr-2 font-medium">Week</th>
            <th className="text-right py-1 px-1 font-medium">Cost</th>
            <th className="text-right py-1 px-1 font-medium">₫/meal</th>
            <th className="text-right py-1 px-1 font-medium">Rev</th>
            <th className="text-right py-1 pl-1 font-medium">Profit</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => {
            const isCurrent = s.weekLabel === currentWeek;
            const hasRevenue = s.revenue > 0;
            const profitColor = !hasRevenue
              ? "text-muted-foreground"
              : s.profit >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-500";

            return (
              <tr
                key={s.weekLabel}
                className={`border-b last:border-0 cursor-pointer transition-colors ${
                  isCurrent ? "bg-primary/8 font-semibold" : "hover:bg-muted/40"
                }`}
                onClick={() => { window.location.href = `/costs?week=${s.weekLabel}`; }}
              >
                <td className="py-1 pr-2 leading-tight">
                  <span className={`block ${isCurrent ? "text-primary" : ""}`}>
                    {s.weekLabel.replace(/^\d+-/, "")}
                  </span>
                  <span className="block text-muted-foreground font-normal" style={{ fontSize: 10 }}>
                    {s.dateRange}
                  </span>
                </td>
                <td className="text-right py-1 px-1 tabular-nums">{fmtK(s.totalCost)}</td>
                <td className="text-right py-1 px-1 tabular-nums text-muted-foreground">
                  {s.costPerMeal ? fmtK(s.costPerMeal) : "—"}
                </td>
                <td className="text-right py-1 px-1 tabular-nums text-muted-foreground">
                  {hasRevenue ? fmtK(s.revenue) : "—"}
                </td>
                <td className={`text-right py-1 pl-1 tabular-nums ${profitColor}`}>
                  {hasRevenue ? `${s.profit >= 0 ? "+" : ""}${fmtK(s.profit)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
