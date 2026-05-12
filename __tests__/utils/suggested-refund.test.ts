import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { suggestedRefund } from "@/lib/utils/subscription";

// Helper to build a date string for a working day offset from "today" in the test
// We freeze time so tests are deterministic.

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns a weekday date relative to a reference Mon (0=Mon, 1=Tue, … 4=Fri) */
function weekday(ref: Date, offsetFromMon: number): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() + offsetFromMon);
  return d;
}

// Freeze time to Wednesday 2026-05-13 (a Wednesday)
const FAKE_NOW = new Date("2026-05-13T08:00:00");
const MON = new Date("2026-05-11T00:00:00"); // Mon of this week

describe("suggestedRefund — all 5 worked examples from spec", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Example A — clean weekly cancel ──────────────────────────────────────
  it("A: weekly, cancel on Wed, no skips → refund 3 days (Wed/Thu/Fri)", () => {
    // Weekly sub: Mon–Fri, pricePerDay = 100k, cancel on Wed
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 0,
      discount: 0,
      endDate: iso(weekday(MON, 4)), // Friday
    };
    const result = suggestedRefund(sub, [], [{ type: "payment", amount: 500_000 }]);
    expect(result.totalDays).toBe(5);
    expect(result.pricePerDay).toBe(100_000);
    expect(result.remainingDays).toBe(3); // Wed, Thu, Fri
    expect(result.futureSkipsNoReplace).toBe(0);
    expect(result.pastSkipsNoReplace).toBe(0);
    expect(result.refundDays).toBe(3);
    expect(result.proRataRefund).toBe(300_000);
    expect(result.suggested).toBe(300_000);
    expect(result.isCapped).toBe(false);
  });

  // ── Example B — with shipping + discount ─────────────────────────────────
  it("B: weekly with shipping+discount, cancel Wed → refund 3 days effective price", () => {
    // effective = 500k + 100k - 50k = 550k → pricePerDay = 110k
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 100_000,
      discount: 50_000,
      endDate: iso(weekday(MON, 4)), // Friday
    };
    const result = suggestedRefund(sub, [], [{ type: "payment", amount: 550_000 }]);
    expect(result.pricePerDay).toBe(110_000);
    expect(result.refundDays).toBe(3);
    expect(result.proRataRefund).toBe(330_000);
    expect(result.suggested).toBe(330_000);
  });

  // ── Example C — past skip without replacement ─────────────────────────────
  it("C: weekly, past skip (Wed prev week, no replacement), cancel on Fri → refund 2 days", () => {
    // endDate = this Friday, cancel on Wednesday (FAKE_NOW)
    // pastSkip = last Wed (a Mon-Fri day before today)
    const lastWed = new Date("2026-05-06T00:00:00"); // previous Wednesday
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 0,
      discount: 0,
      endDate: iso(weekday(MON, 4)), // this Friday
    };
    const skips = [
      { originalDay: iso(lastWed), replacementDay: null },
    ];
    // Today is Wed: remainingDays = 3 (Wed, Thu, Fri), pastSkips=1, futureSkips=0
    // refundDays = 3 + 1 = 4? No wait — Example C says today=Fri.
    // Let me re-read: "Today = Fri (about to cancel before Fri delivery)."
    // So we need today=Fri. Let me set system time to Friday for this test.
    vi.setSystemTime(new Date("2026-05-15T08:00:00")); // Friday
    const resultFri = suggestedRefund(sub, skips, [{ type: "payment", amount: 500_000 }]);
    // remainingDays from Fri inclusive = 1 (just Fri itself)
    // pastSkips = 1 (lastWed < today Fri, no replacement)
    // refundDays = 1 - 0 + 1 = 2
    expect(resultFri.remainingDays).toBe(1);
    expect(resultFri.pastSkipsNoReplace).toBe(1);
    expect(resultFri.futureSkipsNoReplace).toBe(0);
    expect(resultFri.refundDays).toBe(2);
    expect(resultFri.proRataRefund).toBe(200_000);
    expect(resultFri.suggested).toBe(200_000);
  });

  // ── Example D — future skip without replacement ───────────────────────────
  it("D: weekly, future skip Thu no replacement, cancel Tue → refund 3 days", () => {
    vi.setSystemTime(new Date("2026-05-12T08:00:00")); // Tuesday
    const thu = weekday(MON, 3); // Thursday
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 0,
      discount: 0,
      endDate: iso(weekday(MON, 4)), // Friday
    };
    const skips = [
      { originalDay: iso(thu), replacementDay: null }, // future, no replacement
    ];
    // From Tue inclusive: Tue, Wed, Thu, Fri = 4 remaining days
    // futureSkips = 1 (Thu), pastSkips = 0
    // refundDays = 4 - 1 + 0 = 3
    const result = suggestedRefund(sub, skips, [{ type: "payment", amount: 500_000 }]);
    expect(result.remainingDays).toBe(4);
    expect(result.futureSkipsNoReplace).toBe(1);
    expect(result.pastSkipsNoReplace).toBe(0);
    expect(result.refundDays).toBe(3);
    expect(result.proRataRefund).toBe(300_000);
    expect(result.suggested).toBe(300_000);
    expect(result.isCapped).toBe(false);
  });

  // ── Example E — cap kicks in ──────────────────────────────────────────────
  it("E: partial payment, proRata > netPaid → suggested capped at netPaid", () => {
    // Cancel on Mon (day 1), proRata would be full 500k but only 200k paid
    vi.setSystemTime(new Date("2026-05-11T08:00:00")); // Monday
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 0,
      discount: 0,
      endDate: iso(weekday(MON, 4)), // Friday
    };
    // partial payment
    const result = suggestedRefund(sub, [], [{ type: "payment", amount: 200_000 }]);
    // From Mon: 5 remaining days → proRata = 500k
    expect(result.proRataRefund).toBe(500_000);
    expect(result.netPaid).toBe(200_000);
    expect(result.suggested).toBe(200_000);
    expect(result.isCapped).toBe(true);
  });

  // ── Edge case 1: cancel before start ─────────────────────────────────────
  it("Edge: cancel before start date → remainingDays spans full period, no skips", () => {
    // Sub starts next Monday, today is current Monday (MON is 2026-05-11 which is our fake now's week)
    vi.setSystemTime(new Date("2026-05-11T08:00:00")); // Monday
    const nextMon = new Date("2026-05-18T00:00:00");
    const nextFri = new Date("2026-05-22T00:00:00");
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 0,
      discount: 0,
      endDate: iso(nextFri),
    };
    const result = suggestedRefund(sub, [], [{ type: "payment", amount: 500_000 }]);
    // Working days from today (Mon) inclusive through nextFri = 10 days
    // refundDays = 10, proRata = 10 × 100k = 1000k but capped at 500k paid
    expect(result.refundDays).toBe(10);
    expect(result.proRataRefund).toBe(1_000_000);
    expect(result.suggested).toBe(500_000);
    expect(result.isCapped).toBe(true);
  });

  // ── Edge case 2: cancel after end → refund = 0 ───────────────────────────
  it("Edge: cancel after endDate → suggested = 0", () => {
    vi.setSystemTime(new Date("2026-05-20T08:00:00")); // after Friday 15 May
    const sub = {
      plan: "weekly",
      subscriptionPrice: 500_000,
      shippingPrice: 0,
      discount: 0,
      endDate: iso(weekday(MON, 4)), // 2026-05-15 Friday (past)
    };
    const result = suggestedRefund(sub, [], [{ type: "payment", amount: 500_000 }]);
    expect(result.remainingDays).toBe(0);
    expect(result.refundDays).toBe(0);
    expect(result.proRataRefund).toBe(0);
    expect(result.suggested).toBe(0);
    expect(result.isCapped).toBe(false);
  });
});
