"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import type { CostItem, CostCategory } from "@/lib/data/types";
import type { WeekSummary } from "./cost-types";

const PALETTE = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16",
];

function useCssColor(variable: string): string {
  const [color, setColor] = useState("#888888");
  useEffect(() => {
    function read() {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (raw) setColor(raw);
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [variable]);
  return color;
}

function MiniTooltip({
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
    <div className="rounded border bg-background px-2 py-1 text-xs shadow">
      {label && <p className="font-medium mb-0.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{Number(p.value).toLocaleString()}K</span>
        </div>
      ))}
    </div>
  );
}

// ── Trend bars ────────────────────────────────────────────────────────────────
export function TrendChart({ summaries }: { summaries: WeekSummary[] }) {
  const mutedFg = useCssColor("--muted-foreground");
  const border = useCssColor("--border");
  const accent = useCssColor("--accent");
  const axisStyle = { fontSize: 10, fill: mutedFg };

  const data = summaries.slice(-10).map((s) => ({
    week: s.weekLabel.replace(/^\d+-/, ""),
    cost: Math.round(s.totalCost / 1000),
  }));

  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No data</p>;
  }

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={14} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={border} vertical={false} />
          <XAxis dataKey="week" tick={axisStyle} axisLine={false} tickLine={false} interval={0} />
          <YAxis
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            width={32}
            tickFormatter={(v: number) => `${v}K`}
          />
          <Tooltip content={<MiniTooltip />} cursor={{ fill: accent }} />
          <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Category donut ────────────────────────────────────────────────────────────
export function CategoryDonut({
  items,
  categories,
}: {
  items: CostItem[];
  categories: CostCategory[];
}) {
  const breakdown = categories
    .map((c, i) => ({
      name: c.name,
      value: items.filter((item) => item.categoryId === c.id).reduce((s, item) => s + item.amount, 0),
      color: PALETTE[i % PALETTE.length],
    }))
    .filter((c) => c.value > 0);

  if (breakdown.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No items</p>;
  }

  return (
    <div className="space-y-1">
      <div className="h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={breakdown}
              cx="50%"
              cy="50%"
              innerRadius="48%"
              outerRadius="76%"
              paddingAngle={3}
              dataKey="value"
            >
              {breakdown.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                value != null ? [`${(Number(value) / 1000).toFixed(0)}K ₫`, ""] : ["—", ""]
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {breakdown.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1 text-xs min-w-0">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground truncate">{entry.name}</span>
            <span className="font-medium shrink-0">{(entry.value / 1000).toFixed(0)}K</span>
          </div>
        ))}
      </div>
    </div>
  );
}
