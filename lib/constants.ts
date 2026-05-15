import type { Payment } from "@/lib/data/types";

export const PLANS = ["trial", "weekly", "monthly"] as const;
export type Plan = (typeof PLANS)[number];

export const GOALS = ["cutting", "maintenance", "bulking", "keto"] as const;
export type Goal = (typeof GOALS)[number];

export const PAY_STATUSES = ["paid", "partial", "unpaid"] as const;

export const PAYMENT_METHODS: Payment["method"][] = ["cash", "transfer", "momo", "other"];
