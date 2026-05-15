"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
  LineChart, Line, PieChart, Pie,
} from "recharts";

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7", "#f97316", "#64748b"];

interface TooltipPayload {
  name: string;
  value: number;
  color?: string;
}

function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded px-3 py-2 text-xs shadow-md space-y-1">
      {label && <p className="font-medium">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {prefix}{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

export function ReportsCharts({
  weeklyRevenue,
  weeklyMargin,
  goalBreakdown,
  costByCategory,
  weeklyWaste,
}: {
  weeklyRevenue: { week: string; revenue: number; collected: number; cost: number }[];
  weeklyMargin: { week: string; margin: number }[];
  goalBreakdown: { goal: string; subs: number; revenue: number }[];
  costByCategory: { name: string; amount: number }[];
  weeklyWaste: { week: string; rate: number }[];
}) {
  return (
    <div className="space-y-8">
      {/* Recognized revenue vs Cost trend */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recognized Revenue vs Cost (last 8 weeks)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyRevenue} barGap={2}>
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip suffix=" VND" />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name="Recognized" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="collected" name="Collected" fill="#14b8a6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gross margin % trend */}
      {weeklyMargin.some((w) => w.margin !== 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Gross Margin % (last 8 weeks)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyMargin}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip prefix="" suffix="%" />} />
              <Line type="monotone" dataKey="margin" name="Margin" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Goal breakdown */}
      {goalBreakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Per-Goal Breakdown — earned to date (active subs)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={goalBreakdown} layout="vertical" barSize={16}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="goal" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip content={<ChartTooltip prefix="" />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="subs" name="Subs" fill="#6366f1" radius={[0, 3, 3, 0]} />
              <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost by category */}
      {costByCategory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Cost by Category (last 4 weeks)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costByCategory} layout="vertical" barSize={20}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip content={<ChartTooltip suffix=" VND" />} />
              <Bar dataKey="amount" name="Amount" radius={[0, 3, 3, 0]}>
                {costByCategory.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Waste rate trend */}
      {weeklyWaste.some((w) => w.rate > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Waste Rate % (last 8 weeks)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weeklyWaste}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<ChartTooltip prefix="" suffix="%" />} />
              <Line type="monotone" dataKey="rate" name="Waste %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
