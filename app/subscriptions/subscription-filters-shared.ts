export const PLANS = ["trial", "weekly", "monthly"] as const;
export const GOALS = ["cutting", "maintenance", "bulking", "keto"] as const;
export const PAY_STATUSES = ["paid", "partial", "unpaid"] as const;

export interface FilterState {
  q: string;
  plans: Set<string>;
  statuses: Set<string>;
  goals: Set<string>;
  expiringSoon: boolean;
  from: string;
  to: string;
}

export function parseFilters(sp: URLSearchParams): FilterState {
  return {
    q: sp.get("q") ?? "",
    plans: sp.has("plan") ? new Set(sp.getAll("plan")) : new Set(PLANS),
    statuses: sp.has("status") ? new Set(sp.getAll("status")) : new Set(PAY_STATUSES),
    goals: sp.has("goal") ? new Set(sp.getAll("goal")) : new Set(GOALS),
    expiringSoon: sp.get("expiring") === "1",
    from: sp.get("from") ?? "",
    to: sp.get("to") ?? "",
  };
}
