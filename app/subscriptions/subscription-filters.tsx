"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { PLANS, GOALS, PAY_STATUSES, parseFilters } from "./subscription-filters-shared";

function PillToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
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

export function SubscriptionFilters({ totalCount, matchCount }: { totalCount: number; matchCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseFilters(searchParams);

  const update = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const toggleMulti = useCallback(
    (key: string, value: string, allValues: readonly string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.has(key) ? new Set(params.getAll(key)) : new Set(allValues);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      params.delete(key);
      // If all selected, don't add any (means "all")
      if (current.size === allValues.length) {
        // omit from params = "all"
      } else {
        for (const v of current) params.append(key, v);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  function clearAll() {
    router.push(pathname, { scroll: false });
  }

  const hasFilters =
    filters.q !== "" ||
    filters.plans.size !== PLANS.length ||
    filters.statuses.size !== PAY_STATUSES.length ||
    filters.goals.size !== GOALS.length ||
    filters.expiringSoon ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Text search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Input
            className="h-7 text-xs pl-2 pr-6"
            placeholder="Search name or phone…"
            value={filters.q}
            onChange={(e) => update("q", e.target.value || null)}
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => update("q", null)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Plan pills */}
        <div className="flex items-center gap-1">
          {PLANS.map((p) => (
            <PillToggle
              key={p}
              label={p}
              active={filters.plans.has(p)}
              onClick={() => toggleMulti("plan", p, PLANS)}
            />
          ))}
        </div>

        {/* Payment status pills */}
        <div className="flex items-center gap-1">
          {PAY_STATUSES.map((s) => (
            <PillToggle
              key={s}
              label={s}
              active={filters.statuses.has(s)}
              onClick={() => toggleMulti("status", s, PAY_STATUSES)}
            />
          ))}
        </div>

        {/* Goal pills */}
        <div className="flex items-center gap-1">
          {GOALS.map((g) => (
            <PillToggle
              key={g}
              label={g}
              active={filters.goals.has(g)}
              onClick={() => toggleMulti("goal", g, GOALS)}
            />
          ))}
        </div>

        {/* Expiring soon toggle */}
        <PillToggle
          label="⚡ Expiring ≤7d"
          active={filters.expiringSoon}
          onClick={() =>
            update("expiring", filters.expiringSoon ? null : "1")
          }
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground shrink-0">Active between</span>
        <Input
          type="date"
          className="h-6 text-xs w-36"
          value={filters.from}
          onChange={(e) => update("from", e.target.value || null)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          className="h-6 text-xs w-36"
          value={filters.to}
          onChange={(e) => update("to", e.target.value || null)}
        />
        {(filters.from || filters.to) && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("from");
              params.delete("to");
              router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }}
          >
            <X size={12} />
          </button>
        )}
        <span className="ml-2 text-muted-foreground">
          {matchCount} of {totalCount} matching
        </span>
      </div>
    </div>
  );
}
