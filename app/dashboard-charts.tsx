"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function useCssColor(variable: string): string {
  const [color, setColor] = useState("#888888");
  useEffect(() => {
    function read() {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (raw) setColor(raw);
    }
    read();
    // Re-read when the theme class changes (light ↔ dark)
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [variable]);
  return color;
}

const PALETTE = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

const PLAN_COLORS: Record<string, string> = {
  trial: "#f59e0b",
  weekly: "#6366f1",
  monthly: "#22c55e",
};

const GOAL_COLORS: Record<string, string> = {
  cutting: "#ef4444",
  maintenance: "#6366f1",
  bulking: "#22c55e",
};

type ChartProps = {
  planMix: { name: string; value: number }[];
  goalMix: { name: string; value: number }[];
  mealTotalsData: { day: string; dayNum: number; countA: number; nameA: string | null; countB: number; nameB: string | null; total: number }[];
  zoneData: { zone: string; count: number }[];
  renewalData: { bucket: string; count: number }[];
  weeklyMeals: { week: string; weekLabel: string; meals: number }[];
  totalMealsThisWeek: number;
};

function EmptyState() {
  return <p className="text-sm text-muted-foreground py-6 text-center">No data yet</p>;
}

// Custom tooltip for dark-mode compatibility
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name ?? "Count"}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({
  data,
  colors,
  title,
}: {
  data: { name: string; value: number }[];
  colors: Record<string, string>;
  title: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="flex flex-col h-full">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">{title}</p>
      <EmptyState />
    </div>
  );

  return (
    <div className="flex flex-col">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{title}</p>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={colors[entry.name] ?? PALETTE[data.indexOf(entry) % PALETTE.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: colors[entry.name] ?? PALETTE[i % PALETTE.length] }}
            />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
            <span className="font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardCharts({
  planMix,
  goalMix,
  mealTotalsData,
  zoneData,
  renewalData,
  weeklyMeals,
  totalMealsThisWeek,
}: ChartProps) {
  const mutedFg = useCssColor("--muted-foreground");
  const border = useCssColor("--border");
  const accent = useCssColor("--accent");

  const axisStyle = { fontSize: 11, fill: mutedFg };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

      {/* Subscription Mix — spans 2 cols */}
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Subscription Mix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <DonutChart data={planMix} colors={PLAN_COLORS} title="By Plan" />
            <DonutChart data={goalMix} colors={GOAL_COLORS} title="By Goal" />
          </div>
        </CardContent>
      </Card>

      {/* Weekly Meals */}
      <Card className="col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Weekly Meals</CardTitle>
          <span className="text-sm font-semibold tabular-nums">
            {totalMealsThisWeek} <span className="text-xs font-normal text-muted-foreground">this week</span>
          </span>
        </CardHeader>
        <CardContent>
          {weeklyMeals.every((w) => w.meals === 0) ? (
            <EmptyState />
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={weeklyMeals} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
                  <XAxis dataKey="week" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: accent }} />
                  <Bar dataKey="meals" name="Meals" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meal Totals — same table as Menu page */}
      <Card className="col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Meal Totals</CardTitle>
          <span className="text-sm font-semibold tabular-nums">
            {totalMealsThisWeek} <span className="text-xs font-normal text-muted-foreground">meals total</span>
          </span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-1.5 font-medium">Day</th>
                  <th className="text-center px-3 py-1.5 font-medium">Option A</th>
                  <th className="text-center px-3 py-1.5 font-medium">Option B</th>
                  <th className="text-center px-3 py-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mealTotalsData.map((row) => (
                  <tr key={row.dayNum}>
                    <td className="px-3 py-1.5 font-medium">{row.day}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="font-mono">{row.countA}</span>
                      {row.nameA && <span className="text-xs text-muted-foreground ml-1">({row.nameA})</span>}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="font-mono">{row.countB}</span>
                      {row.nameB && <span className="text-xs text-muted-foreground ml-1">({row.nameB})</span>}
                    </td>
                    <td className="px-3 py-1.5 text-center font-bold">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customers by Zone */}
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Customers by Zone</CardTitle>
        </CardHeader>
        <CardContent>
          {zoneData.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={zoneData} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke={border} horizontal={false} />
                  <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="zone"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + "…" : v}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: accent }} />
                  <Bar dataKey="count" name="Customers">
                    {zoneData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renewal Timeline */}
      <Card className="col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Renewal Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {renewalData.every((d) => d.count === 0) ? (
            <EmptyState />
          ) : (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={renewalData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
                  <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: accent }} />
                  <Bar dataKey="count" name="Subscriptions" radius={[4, 4, 0, 0]}>
                    {renewalData.map((_, i) => {
                      const urgency = ["#ef4444", "#f97316", "#f59e0b", "#6366f1", "#22c55e"][i] ?? "#6366f1";
                      return <Cell key={i} fill={urgency} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
