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

// Week fixture: Mon 2026-05-11 – Fri 2026-05-15, next Mon 2026-05-18, next Tue 2026-05-19
const WED = "2026-05-13";
const THU = "2026-05-14";
const FRI = "2026-05-15";
const NEXT_MON = "2026-05-18";
const NEXT_TUE = "2026-05-19";

function makeSub(endDate: string) {
  return { plan: "weekly", subscriptionPrice: 500_000, shippingPrice: 0, discount: 0, endDate };
}
function paid(amount: number) {
  return [{ type: "payment" as const, amount }];
}
function skipNoReplace(day: string) {
  return { originalDay: day + "T00:00:00.000Z", replacementDay: null };
}
function skipWithReplace(day: string, rep: string) {
  return { originalDay: day + "T00:00:00.000Z", replacementDay: rep + "T00:00:00.000Z" };
}

// ── Extras refund — no skips ──────────────────────────────────────────────────
describe("suggestedRefund — extras, no skips", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("user scenario: weekly May13–19, extra protein May14–19 (4d ₫40k), cancel May18 → ₫20k", () => {
    // Sub: Wed May13 – Tue May19 (5 days, ₫100k/day)
    // Extra: Thu May14 – Tue May19 (4 working days: Thu,Fri,Mon,Tue = ₫10k/day)
    // Consumed: May13,14,15 (3 meals). Cancel May18 (Mon, first unserved).
    vi.setSystemTime(new Date(NEXT_MON + "T08:00:00"));
    const result = suggestedRefund(
      makeSub(NEXT_TUE),
      [],
      paid(540_000),
      undefined,
      [{ amount: 40_000, startDate: THU + "T00:00:00.000Z", endDate: NEXT_TUE + "T00:00:00.000Z" }]
    );
    // refundStart = max(Mon18, Thu14) = Mon18; remaining = 2 (Mon18, Tue19)
    expect(result.extrasRefund).toBe(20_000); // 40k × 2/4
    expect(result.suggested).toBe(220_000);   // 200k sub + 20k extra
  });

  it("cancel before extra period → full extra refund (clamped to period start)", () => {
    // Cancel Tue May12, extra is Thu–Fri
    vi.setSystemTime(new Date("2026-05-12T08:00:00"));
    const result = suggestedRefund(
      makeSub(FRI),
      [],
      paid(540_000),
      undefined,
      [{ amount: 40_000, startDate: THU + "T00:00:00.000Z", endDate: FRI + "T00:00:00.000Z" }]
    );
    // refundStart = max(Tue12, Thu14) = Thu14; remaining = 2 (Thu,Fri); totalDays = 2
    expect(result.extrasRefund).toBe(40_000);
  });

  it("cancel after extra period → extra refund = 0", () => {
    vi.setSystemTime(new Date(NEXT_MON + "T08:00:00")); // Mon18
    const result = suggestedRefund(
      makeSub(NEXT_TUE),
      [],
      paid(540_000),
      undefined,
      [{ amount: 40_000, startDate: WED + "T00:00:00.000Z", endDate: FRI + "T00:00:00.000Z" }]
    );
    // Extra period Wed–Fri, cancel Mon18 → refundStart Mon18 > end Fri15 → 0
    expect(result.extrasRefund).toBe(0);
  });
});

// ── Extras refund — with skips ────────────────────────────────────────────────
describe("suggestedRefund — extras, skip interactions", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // Extra: Wed–Thu (2 days, ₫200k = ₫100k/day)
  const extra2d = [{ amount: 200_000, startDate: WED + "T00:00:00.000Z", endDate: THU + "T00:00:00.000Z" }];

  it("past skip (no replace) in extra period, cancel Thu → full refund (Wed not served)", () => {
    // Skip Wed (no replace), cancel Thu (first unserved). Wed's extra never delivered.
    vi.setSystemTime(new Date(THU + "T08:00:00"));
    const result = suggestedRefund(makeSub(FRI), [skipNoReplace(WED)], paid(700_000), undefined, extra2d);
    // remaining = countWorkingDays(Thu, Fri) = 1; pastSkipsInPeriod = 1 (Wed)
    // adjustedRemaining = min(2, 1+1) = 2 → full refund
    expect(result.extrasRefund).toBe(200_000);
  });

  it("past skip (no replace) in extra period, cancel Fri (after period) → partial refund for unserved Wed", () => {
    // Skip Wed (no replace), cancel Fri. Thu served. Wed never served.
    vi.setSystemTime(new Date(FRI + "T08:00:00"));
    const result = suggestedRefund(makeSub(FRI), [skipNoReplace(WED)], paid(700_000), undefined, extra2d);
    // refundStart = max(Fri, Wed) = Fri > end(Thu) → remaining = 0
    // pastSkipsInPeriod = 1 (Wed < Fri, no replace) → adjustedRemaining = min(2, 1) = 1
    expect(result.extrasRefund).toBe(100_000);
  });

  it("past skip with replacement INSIDE extra period → no extra refund for that day", () => {
    // Skip Wed → replace Thu (inside period). Both days covered. Cancel Fri (after period).
    vi.setSystemTime(new Date(FRI + "T08:00:00"));
    const result = suggestedRefund(makeSub(FRI), [skipWithReplace(WED, THU)], paid(700_000), undefined, extra2d);
    // replacement Thu is within [Wed, Thu] → pastSkipsInPeriod = 0
    // remaining = 0 (cancel after period) → adjustedRemaining = 0
    expect(result.extrasRefund).toBe(0);
  });

  it("past skip with replacement OUTSIDE extra period → refund that day's extra", () => {
    // Skip Wed → replace next Mon (outside extra period Wed–Thu). Cancel Fri.
    vi.setSystemTime(new Date(FRI + "T08:00:00"));
    const result = suggestedRefund(makeSub(FRI), [skipWithReplace(WED, NEXT_MON)], paid(700_000), undefined, extra2d);
    // replacement Mon18 > end Thu14 → outside period → pastSkipsInPeriod = 1
    // remaining = 0; adjustedRemaining = 1 → ₫100k
    expect(result.extrasRefund).toBe(100_000);
  });
});
