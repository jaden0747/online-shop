import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pricePerDay, daysDeliveredAsOf, earnedRevenueAsOf, earnedRevenueInRange, deferredRevenue } from "@/lib/utils/revenue";
import type { Subscription, MealSkip, SubscriptionExtra, Payment, CreditTransaction } from "@/lib/data/types";

// ── Test fixture helpers ──────────────────────────────────────────────────────

function d(iso: string): Date {
  const r = new Date(iso + "T00:00:00");
  r.setHours(0, 0, 0, 0);
  return r;
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub1",
    customerId: "cust1",
    plan: "weekly",
    goal: "cutting",
    mealsPerDay: 1,
    status: "active",
    shippingPrice: 0,
    subscriptionPrice: 500_000, // 5-day week, 100k/day
    discount: 0,
    trialDays: null,
    startDate: "2026-05-11T00:00:00.000Z", // Mon
    endDate:   "2026-05-15T00:00:00.000Z", // Fri
    endDateNoSkip: "2026-05-15T00:00:00.000Z",
    cancelReason: null,
    cancelledAt: null,
    addressId: null,
    createdAt: "2026-05-11T00:00:00.000Z",
    ...overrides,
  };
}

function skip(originalDay: string, replacementDay: string | null = null): MealSkip {
  return {
    id: `sk-${originalDay}`,
    subscriptionId: "sub1",
    originalDay: originalDay + "T00:00:00.000Z",
    replacementDay: replacementDay ? replacementDay + "T00:00:00.000Z" : null,
    reason: null,
    createdAt: "2026-05-11T00:00:00.000Z",
  };
}

function extra(amount: number, forDate: string | null, createdAt = "2026-05-11"): SubscriptionExtra {
  return {
    id: `e-${Math.random()}`,
    subscriptionId: "sub1",
    amount,
    note: null,
    forDate: forDate ? forDate + "T00:00:00.000Z" : null,
    createdAt: createdAt + "T00:00:00.000Z",
  };
}

// Mon 2026-05-11 → Fri 2026-05-15 (the test week)
const MON = "2026-05-11";
const TUE = "2026-05-12";
const WED = "2026-05-13";
const THU = "2026-05-14";
const FRI = "2026-05-15";
// Next week
const NEXT_MON = "2026-05-18";
const NEXT_FRI = "2026-05-22";

// ── pricePerDay ───────────────────────────────────────────────────────────────

describe("pricePerDay", () => {
  it("full 5-day week → 100k/day", () => {
    expect(pricePerDay(makeSub())).toBeCloseTo(100_000);
  });

  it("prorated 3-day week (Wed–Fri, charged 300k) → 100k/day", () => {
    const sub = makeSub({
      subscriptionPrice: 300_000,
      startDate: WED + "T00:00:00.000Z",
      endDate: FRI + "T00:00:00.000Z",
      endDateNoSkip: FRI + "T00:00:00.000Z",
    });
    expect(pricePerDay(sub)).toBeCloseTo(100_000);
  });

  it("shipping and discount are folded in", () => {
    const sub = makeSub({ shippingPrice: 50_000, discount: 50_000 });
    // effective = 500k + 50k - 50k = 500k / 5 days = 100k
    expect(pricePerDay(sub)).toBeCloseTo(100_000);
  });
});

// ── daysDeliveredAsOf ─────────────────────────────────────────────────────────

describe("daysDeliveredAsOf", () => {
  it("no skips, asOf = Friday → 5 days", () => {
    expect(daysDeliveredAsOf(makeSub(), [], d(FRI))).toBe(5);
  });

  it("no skips, asOf = Wednesday → 3 days (Mon, Tue, Wed)", () => {
    expect(daysDeliveredAsOf(makeSub(), [], d(WED))).toBe(3);
  });

  it("skip Wednesday (no replacement), asOf = Friday → 4 days", () => {
    expect(daysDeliveredAsOf(makeSub(), [skip(WED)], d(FRI))).toBe(4);
  });

  it("skip Wednesday (no replacement), asOf = Wednesday → 2 days (Mon, Tue)", () => {
    expect(daysDeliveredAsOf(makeSub(), [skip(WED)], d(WED))).toBe(2);
  });

  it("skip Wednesday, replacement next Monday, asOf = Friday → 4 days (Wed not served yet, Mon replacement not yet)", () => {
    // originalDay=Wed, replacement=next Mon. asOf=Fri.
    // scheduled Mon–Fri = 5. skipped in range: Wed. Net = 4.
    // (next Mon's replacement hasn't happened yet — not in range)
    expect(daysDeliveredAsOf(makeSub(), [skip(WED, NEXT_MON)], d(FRI))).toBe(4);
  });

  it("skip Wednesday, replacement next Monday, asOf = next Monday → 5 days", () => {
    // Extend endDate to cover next Mon so the replacement is within the sub period.
    const sub = makeSub({ endDate: NEXT_MON + "T00:00:00.000Z", endDateNoSkip: FRI + "T00:00:00.000Z" });
    // scheduled Mon–next Mon = 6 working days. skipped Wed = 1. Net = 5.
    expect(daysDeliveredAsOf(sub, [skip(WED, NEXT_MON)], d(NEXT_MON))).toBe(5);
  });

  it("cancelled mid-week: cancelledAt = Wednesday, asOf = Friday → 3 days", () => {
    const sub = makeSub({ status: "cancelled", cancelledAt: WED + "T00:00:00.000Z" });
    // cutoff = min(Fri, Wed) = Wed. Working days Mon–Wed = 3.
    expect(daysDeliveredAsOf(sub, [], d(FRI))).toBe(3);
  });

  it("asOf before startDate → 0", () => {
    expect(daysDeliveredAsOf(makeSub(), [], d("2026-05-08"))).toBe(0);
  });
});

// ── earnedRevenueAsOf ─────────────────────────────────────────────────────────

describe("earnedRevenueAsOf", () => {
  it("full week delivered → 500k", () => {
    expect(earnedRevenueAsOf(makeSub(), [], [], d(FRI))).toBe(500_000);
  });

  it("3 days delivered → 300k", () => {
    expect(earnedRevenueAsOf(makeSub(), [], [], d(WED))).toBe(300_000);
  });

  it("extra with forDate in period adds to earned", () => {
    const result = earnedRevenueAsOf(makeSub(), [], [extra(20_000, WED)], d(FRI));
    expect(result).toBe(520_000);
  });

  it("extra with forDate after asOf is not yet recognized", () => {
    const result = earnedRevenueAsOf(makeSub(), [], [extra(20_000, FRI)], d(WED));
    expect(result).toBe(300_000); // only 3 days, extra not yet due
  });

  it("extra with no forDate uses createdAt (Mon) → recognized by Wed", () => {
    const result = earnedRevenueAsOf(makeSub(), [], [extra(10_000, null, MON)], d(WED));
    expect(result).toBe(310_000);
  });
});

// ── earnedRevenueInRange ──────────────────────────────────────────────────────

describe("earnedRevenueInRange", () => {
  it("full week in range → 500k", () => {
    expect(earnedRevenueInRange(makeSub(), [], [], d(MON), d(FRI))).toBe(500_000);
  });

  it("range is Mon–Wed only → 300k", () => {
    expect(earnedRevenueInRange(makeSub(), [], [], d(MON), d(WED))).toBe(300_000);
  });

  it("range before sub starts → 0", () => {
    expect(earnedRevenueInRange(makeSub(), [], [], d("2026-05-04"), d("2026-05-08"))).toBe(0);
  });

  it("range after sub ends → 0", () => {
    expect(earnedRevenueInRange(makeSub(), [], [], d(NEXT_MON), d(NEXT_FRI))).toBe(0);
  });

  it("skip without replacement: day not earned in that week", () => {
    // Skip Wed, no replacement → only 4 days recognized this week
    expect(earnedRevenueInRange(makeSub(), [skip(WED)], [], d(MON), d(FRI))).toBe(400_000);
  });

  it("skip Wednesday, replacement next Monday: this week 4 days, next week 1 day (replacement)", () => {
    // Sub extends to next Mon for the replacement.
    const sub = makeSub({ endDate: NEXT_MON + "T00:00:00.000Z", endDateNoSkip: FRI + "T00:00:00.000Z" });
    const skips = [skip(WED, NEXT_MON)];
    // This week: Mon, Tue, Thu, Fri = 4 days (Wed original skipped)
    expect(earnedRevenueInRange(sub, skips, [], d(MON), d(FRI))).toBe(400_000);
    // Next week: Mon (replacement, which IS a working day in that range and NOT a skip)
    expect(earnedRevenueInRange(sub, skips, [], d(NEXT_MON), d(NEXT_FRI))).toBe(100_000);
  });

  it("extra with forDate in range is included", () => {
    expect(earnedRevenueInRange(makeSub(), [], [extra(25_000, WED)], d(MON), d(FRI))).toBe(525_000);
  });

  it("extra with forDate outside range is excluded", () => {
    expect(earnedRevenueInRange(makeSub(), [], [extra(25_000, NEXT_MON)], d(MON), d(FRI))).toBe(500_000);
  });

  it("mid-week cancel: only days up to cancelledAt are earned", () => {
    const sub = makeSub({ status: "cancelled", cancelledAt: WED + "T00:00:00.000Z" });
    // cutoff = Wed. Range Mon–Fri intersects to Mon–Wed = 3 days.
    expect(earnedRevenueInRange(sub, [], [], d(MON), d(FRI))).toBe(300_000);
  });
});

// ── deferredRevenue ───────────────────────────────────────────────────────────

describe("deferredRevenue", () => {
  function pay(amount: number, type: Payment["type"] = "payment"): Payment {
    return { id: `p-${Math.random()}`, subscriptionId: "sub1", type, amount, paidAt: MON + "T00:00:00.000Z", method: "transfer", note: null, createdAt: MON + "T00:00:00.000Z" };
  }
  function credit(amount: number): CreditTransaction {
    return { id: `c-${Math.random()}`, customerId: "cust1", type: "refund_credit", amount, subscriptionId: "sub1", note: "", createdAt: MON + "T00:00:00.000Z" };
  }

  it("paid 500k, 0 days delivered → deferred = 500k", () => {
    expect(deferredRevenue(makeSub(), [pay(500_000)], [], [], [], d("2026-05-10"))).toBe(500_000);
  });

  it("paid 500k, 3 days delivered → deferred = 200k", () => {
    expect(deferredRevenue(makeSub(), [pay(500_000)], [], [], [], d(WED))).toBe(200_000);
  });

  it("paid 500k, fully delivered → deferred = 0", () => {
    expect(deferredRevenue(makeSub(), [pay(500_000)], [], [], [], d(FRI))).toBe(0);
  });

  it("paid 500k, refunded 300k (cancelled 2 days used) → deferred = 0", () => {
    // 2 days earned, 300k refunded, collected-refunded-earned = 500k-300k-200k = 0
    const sub = makeSub({ status: "cancelled", cancelledAt: TUE + "T00:00:00.000Z" });
    expect(deferredRevenue(sub, [pay(500_000), pay(300_000, "refund")], [], [], [], d(FRI))).toBe(0);
  });

  it("paid 500k, 200k refund-to-credit, 3 days used → deferred = 0", () => {
    const sub = makeSub({ status: "cancelled", cancelledAt: WED + "T00:00:00.000Z" });
    // earned = 300k. collected=500k, refund=0, refund_credit=200k. deferred = max(0, 500-0-200-300) = 0
    expect(deferredRevenue(sub, [pay(500_000)], [credit(200_000)], [], [], d(FRI))).toBe(0);
  });

  it("no payment → deferred = 0 (can't be negative)", () => {
    expect(deferredRevenue(makeSub(), [], [], [], [], d(FRI))).toBe(0);
  });
});
