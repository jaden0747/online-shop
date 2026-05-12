import type { CreditTransaction } from "@/lib/data/types";

/** Types that increase the credit balance */
const CREDIT_TYPES: CreditTransaction["type"][] = ["refund_credit", "manual_topup"];

/** Types that decrease the credit balance */
const DEBIT_TYPES: CreditTransaction["type"][] = ["credit_used"];

/** adjustment can be positive or negative — we treat it as a debit when amount is logged under credit_used, so adjustment is always added */

/**
 * Calculate credit balance for an array of transactions belonging to ONE customer.
 * Balance = sum of credits - sum of debits.
 * Adjustments are always added (use negative amounts for downward adjustments).
 */
export function creditBalance(transactions: CreditTransaction[]): number {
  return transactions.reduce((acc, t) => {
    if (CREDIT_TYPES.includes(t.type) || t.type === "adjustment") {
      return acc + t.amount;
    }
    if (DEBIT_TYPES.includes(t.type)) {
      return acc - t.amount;
    }
    return acc;
  }, 0);
}

/**
 * Calculate credit balance for a specific customer from a full list of transactions.
 */
export function creditBalanceByCustomer(
  transactions: CreditTransaction[],
  customerId: string
): number {
  return creditBalance(transactions.filter((t) => t.customerId === customerId));
}

/**
 * Build a map of { customerId → creditBalance } from the full transaction list.
 * Only customers with a non-zero balance are included.
 */
export function allCustomerCreditBalances(
  transactions: CreditTransaction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const prev = map.get(t.customerId) ?? 0;
    let delta = 0;
    if (CREDIT_TYPES.includes(t.type) || t.type === "adjustment") delta = t.amount;
    if (DEBIT_TYPES.includes(t.type)) delta = -t.amount;
    map.set(t.customerId, prev + delta);
  }
  // Remove customers with zero balance to keep the map lean
  for (const [k, v] of map) {
    if (v === 0) map.delete(k);
  }
  return map;
}
