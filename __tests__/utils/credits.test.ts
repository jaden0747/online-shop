import { describe, it, expect } from "vitest";
import { creditBalance, creditBalanceByCustomer, allCustomerCreditBalances } from "@/lib/utils/credits";
import type { CreditTransaction } from "@/lib/data/types";

function makeTx(overrides: Partial<CreditTransaction> & { type: CreditTransaction["type"]; amount: number }): CreditTransaction {
  return {
    id: crypto.randomUUID(),
    customerId: "0901000001",
    subscriptionId: null,
    note: "test",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("creditBalance", () => {
  it("returns 0 for empty list", () => {
    expect(creditBalance([])).toBe(0);
  });

  it("adds refund_credit", () => {
    const txs = [makeTx({ type: "refund_credit", amount: 50_000 })];
    expect(creditBalance(txs)).toBe(50_000);
  });

  it("adds manual_topup", () => {
    const txs = [makeTx({ type: "manual_topup", amount: 100_000 })];
    expect(creditBalance(txs)).toBe(100_000);
  });

  it("subtracts credit_used", () => {
    const txs = [
      makeTx({ type: "manual_topup", amount: 100_000 }),
      makeTx({ type: "credit_used", amount: 60_000 }),
    ];
    expect(creditBalance(txs)).toBe(40_000);
  });

  it("adds adjustment", () => {
    const txs = [
      makeTx({ type: "manual_topup", amount: 50_000 }),
      makeTx({ type: "adjustment", amount: 10_000 }),
    ];
    expect(creditBalance(txs)).toBe(60_000);
  });

  it("handles multiple transactions correctly", () => {
    const txs = [
      makeTx({ type: "refund_credit", amount: 200_000 }),
      makeTx({ type: "manual_topup", amount: 50_000 }),
      makeTx({ type: "credit_used", amount: 80_000 }),
      makeTx({ type: "credit_used", amount: 30_000 }),
    ];
    // 200k + 50k - 80k - 30k = 140k
    expect(creditBalance(txs)).toBe(140_000);
  });

  it("can go negative (soft warning, not blocked at calculation level)", () => {
    const txs = [
      makeTx({ type: "manual_topup", amount: 50_000 }),
      makeTx({ type: "credit_used", amount: 80_000 }),
    ];
    expect(creditBalance(txs)).toBe(-30_000);
  });
});

describe("creditBalanceByCustomer", () => {
  it("filters transactions by customerId", () => {
    const txs = [
      makeTx({ customerId: "A", type: "manual_topup", amount: 100_000 }),
      makeTx({ customerId: "B", type: "manual_topup", amount: 200_000 }),
      makeTx({ customerId: "A", type: "credit_used", amount: 40_000 }),
    ];
    expect(creditBalanceByCustomer(txs, "A")).toBe(60_000);
    expect(creditBalanceByCustomer(txs, "B")).toBe(200_000);
    expect(creditBalanceByCustomer(txs, "C")).toBe(0);
  });
});

describe("allCustomerCreditBalances", () => {
  it("returns a map with correct balances", () => {
    const txs = [
      makeTx({ customerId: "A", type: "manual_topup", amount: 100_000 }),
      makeTx({ customerId: "B", type: "refund_credit", amount: 50_000 }),
      makeTx({ customerId: "A", type: "credit_used", amount: 100_000 }),
    ];
    const map = allCustomerCreditBalances(txs);
    // A: 100k - 100k = 0 → excluded from map
    // B: 50k
    expect(map.has("A")).toBe(false);
    expect(map.get("B")).toBe(50_000);
  });

  it("excludes customers with zero balance", () => {
    const txs = [
      makeTx({ customerId: "A", type: "manual_topup", amount: 50_000 }),
      makeTx({ customerId: "A", type: "credit_used", amount: 50_000 }),
    ];
    const map = allCustomerCreditBalances(txs);
    expect(map.size).toBe(0);
  });

  it("includes customers with negative balance", () => {
    const txs = [
      makeTx({ customerId: "A", type: "credit_used", amount: 30_000 }),
    ];
    const map = allCustomerCreditBalances(txs);
    expect(map.get("A")).toBe(-30_000);
  });
});
