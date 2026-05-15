"use client";

import { useState, useCallback } from "react";
import { daysRemaining } from "@/lib/utils/subscription";
import { recordRecentCustomer } from "@/lib/utils/use-recent-customers";
import { useTableSettings } from "@/lib/utils/use-table-settings";
import { PLANS } from "@/lib/constants";
import { SubscriptionEndDateCell } from "@/components/subscription-end-date-cell";
import { Pencil, X } from "lucide-react";
import { PhoneDisplay } from "@/components/phone-display";

export type AddressItem = {
  label: string;
  address: string;
  isDefault: boolean;
};

export type ActiveSub = {
  plan: string;
  goal: string;
  subscriptionPrice: number;
  shippingPrice: number;
  endDate: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  zone: string;
  addresses: AddressItem[];
  activeSubs: ActiveSub[];
  totalSpend: number;
  hasSubs: boolean;
  createdAt: string;
};

type StatusFilter = "all" | "active" | "inactive" | "none";
type SortBy = "default" | "newest" | "revenue-desc" | "revenue-asc";

function PillToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2 py-0.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-foreground/40",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function UnifiedCustomerTable({
  rows,
  onOpenCustomer,
}: {
  rows: CustomerRow[];
  onOpenCustomer: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planFilter, setPlanFilter] = useState<Set<string>>(new Set());
  const [expiring, setExpiring] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("default");
  const { zebraStripe, stickyHeader, toggle } = useTableSettings();

  const handleOpen = useCallback(
    (r: CustomerRow) => {
      recordRecentCustomer({ id: r.id, name: r.name, phone: r.phone });
      onOpenCustomer(r.id);
    },
    [onOpenCustomer]
  );

  function togglePlan(plan: string) {
    setPlanFilter((prev) => {
      const next = new Set(prev);
      if (next.has(plan)) next.delete(plan);
      else next.add(plan);
      return next;
    });
  }

  // Filter
  let filtered = rows;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) => r.name.toLowerCase().includes(q) || r.phone.includes(search.trim())
    );
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter((r) => {
      if (statusFilter === "active") return r.activeSubs.length > 0;
      if (statusFilter === "inactive") return r.activeSubs.length === 0 && r.hasSubs;
      if (statusFilter === "none") return !r.hasSubs;
      return true;
    });
  }
  if (planFilter.size > 0) {
    filtered = filtered.filter((r) => r.activeSubs.some((s) => planFilter.has(s.plan)));
  }
  if (expiring) {
    filtered = filtered.filter((r) => r.activeSubs.some((s) => daysRemaining(s.endDate) <= 7));
  }

  // Sort
  const sorted = [...filtered];
  if (sortBy === "newest") {
    sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy === "revenue-desc") {
    sorted.sort((a, b) => b.totalSpend - a.totalSpend);
  } else if (sortBy === "revenue-asc") {
    sorted.sort((a, b) => a.totalSpend - b.totalSpend);
  }

  const hasFilters =
    !!search.trim() || statusFilter !== "all" || planFilter.size > 0 || expiring || sortBy !== "default";

  return (
    <div>
      {/* Filter bar */}
      <div className="px-4 py-2 border-b">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] max-w-xs text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />

          <div className="flex items-center gap-1">
            {(["all", "active", "inactive", "none"] as StatusFilter[]).map((s) => (
              <PillToggle
                key={s}
                label={s === "all" ? "All" : s === "none" ? "No sub" : s.charAt(0).toUpperCase() + s.slice(1)}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            {PLANS.map((p) => (
              <PillToggle
                key={p}
                label={p}
                active={planFilter.has(p)}
                onClick={() => togglePlan(p)}
              />
            ))}
          </div>

          <PillToggle label="⚡ Expiring ≤7d" active={expiring} onClick={() => setExpiring((v) => !v)} />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-6 px-1 text-xs rounded border border-border bg-background text-foreground cursor-pointer"
          >
            <option value="default">Sort: Default</option>
            <option value="newest">Sort: Newest</option>
            <option value="revenue-desc">Sort: Revenue ↓</option>
            <option value="revenue-asc">Sort: Revenue ↑</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPlanFilter(new Set());
                setExpiring(false);
                setSortBy("default");
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={11} />
              Clear
            </button>
          )}

          <span className="h-4 w-px bg-border ml-1" />
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
            <input type="checkbox" checked={zebraStripe} onChange={() => toggle("zebraStripe")} className="h-3 w-3 accent-primary" />
            Stripes
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
            <input type="checkbox" checked={stickyHeader} onChange={() => toggle("stickyHeader")} className="h-3 w-3 accent-primary" />
            Freeze header
          </label>

          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {sorted.length} of {rows.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className={stickyHeader ? "overflow-auto max-h-[70vh]" : "overflow-x-auto"}>
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className={`border-b ${stickyHeader ? "bg-muted shadow-sm" : "bg-muted/50"}`}>
              <th className="w-10" />
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-left px-4 py-2 font-medium">Zone</th>
              <th className="text-left px-4 py-2 font-medium">Active Subscriptions</th>
              <th className="text-left px-4 py-2 font-medium">Revenue</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  {search.trim() ? `No customers matching "${search}"` : "No customers."}
                </td>
              </tr>
            )}
            {sorted.map((r, i) => (
              <tr key={r.id} className={`hover:bg-accent/50 transition-colors ${zebraStripe && i % 2 !== 0 ? "bg-muted/25" : ""}`}>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => handleOpen(r)}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit customer"
                  >
                    <Pencil size={14} />
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button type="button" onClick={() => handleOpen(r)} className="text-left">
                    <span className="font-medium leading-none block hover:underline">{r.name}</span>
                    <PhoneDisplay phone={r.phone} />
                  </button>
                </td>
                <td className="px-4 py-2 max-w-[220px]">
                  {r.addresses.length === 0 ? (
                    <span className="text-xs text-muted-foreground opacity-40">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {r.addresses.map((a, i) => (
                        <div
                          key={i}
                          className={`text-xs truncate ${a.isDefault ? "font-medium text-foreground" : "text-muted-foreground/60"}`}
                        >
                          {a.address}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {r.zone || <span className="opacity-40">—</span>}
                </td>
                <td className="px-4 py-2">
                  {r.activeSubs.length === 0 ? (
                    <span className="text-xs text-muted-foreground opacity-40">—</span>
                  ) : (
                    <div className="space-y-1">
                      {r.activeSubs.map((s, i) => {
                        const total = s.subscriptionPrice + s.shippingPrice;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs capitalize font-medium">{s.plan}</span>
                            <span className="text-xs text-muted-foreground">
                              · {s.goal} · {total.toLocaleString()} VND
                            </span>
                            <SubscriptionEndDateCell endDate={s.endDate} compact />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.totalSpend > 0 ? (
                    <span className="font-medium tabular-nums">{r.totalSpend.toLocaleString()} VND</span>
                  ) : (
                    <span className="text-muted-foreground opacity-40">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.notes ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title={r.notes} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
