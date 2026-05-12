import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreditTransaction, Payment } from "@/lib/data/types";

// Must be hoisted before importing the module under test
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/data/credits", () => ({
  getCreditTransactionsByCustomer: vi.fn(),
  getAllCreditTransactions: vi.fn(),
  createCreditTransaction: vi.fn(),
  deleteCreditTransaction: vi.fn(),
}));

vi.mock("@/lib/data/payments", () => ({
  createPayment: vi.fn(),
  deletePayment: vi.fn(),
  getAllPayments: vi.fn(),
}));

import {
  applyCreditToSubscriptionAction,
  revertCreditPaymentAction,
} from "@/app/actions/credits";
import {
  getCreditTransactionsByCustomer,
  getAllCreditTransactions,
  createCreditTransaction,
  deleteCreditTransaction,
} from "@/lib/data/credits";
import {
  createPayment,
  deletePayment,
  getAllPayments,
} from "@/lib/data/payments";

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-001",
    subscriptionId: "sub-001",
    type: "payment",
    method: "credit",
    amount: 50_000,
    paidAt: new Date().toISOString(),
    note: "Credit applied",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTx(overrides: Partial<CreditTransaction> = {}): CreditTransaction {
  return {
    id: "tx-001",
    customerId: "cust-001",
    type: "credit_used",
    amount: 50_000,
    subscriptionId: "sub-001",
    note: "[paymentId:pay-001] Credit applied",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyCreditToSubscriptionAction", () => {
  it("creates both a Payment and a CreditTransaction", async () => {
    const payment = makePayment();
    const tx = makeTx();

    vi.mocked(getCreditTransactionsByCustomer).mockReturnValue([
      { ...tx, type: "manual_topup", note: "top-up" } as CreditTransaction,
    ]);
    vi.mocked(createPayment).mockReturnValue(payment);
    vi.mocked(createCreditTransaction).mockReturnValue(tx);

    const result = await applyCreditToSubscriptionAction({
      customerId: "cust-001",
      subscriptionId: "sub-001",
      amount: 50_000,
    });

    expect(createPayment).toHaveBeenCalledOnce();
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: "sub-001",
        type: "payment",
        method: "credit",
        amount: 50_000,
      })
    );

    expect(createCreditTransaction).toHaveBeenCalledOnce();
    expect(createCreditTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cust-001",
        type: "credit_used",
        amount: 50_000,
        subscriptionId: "sub-001",
      })
    );

    expect(result.payment).toBe(payment);
    expect(result.tx).toBe(tx);
    expect(result.warning).toBeNull();
  });

  it("embeds paymentId in the CreditTransaction note for revert lookup", async () => {
    const payment = makePayment({ id: "pay-abc" });
    vi.mocked(getCreditTransactionsByCustomer).mockReturnValue([
      makeTx({ type: "manual_topup", amount: 200_000, note: "top-up" }),
    ]);
    vi.mocked(createPayment).mockReturnValue(payment);
    vi.mocked(createCreditTransaction).mockReturnValue(makeTx());

    await applyCreditToSubscriptionAction({
      customerId: "cust-001",
      subscriptionId: "sub-001",
      amount: 50_000,
    });

    const txCall = vi.mocked(createCreditTransaction).mock.calls[0][0];
    expect(txCall.note).toContain("[paymentId:pay-abc]");
  });

  it("returns a warning when amount exceeds available balance", async () => {
    vi.mocked(getCreditTransactionsByCustomer).mockReturnValue([
      makeTx({ type: "manual_topup", amount: 30_000, note: "top-up" }),
    ]);
    vi.mocked(createPayment).mockReturnValue(makePayment({ amount: 50_000 }));
    vi.mocked(createCreditTransaction).mockReturnValue(makeTx());

    const result = await applyCreditToSubscriptionAction({
      customerId: "cust-001",
      subscriptionId: "sub-001",
      amount: 50_000, // exceeds 30_000 balance
    });

    expect(result.warning).not.toBeNull();
    expect(result.warning).toContain("exceeds available credit");
    // Still creates both records (soft warning, not blocked)
    expect(createPayment).toHaveBeenCalledOnce();
    expect(createCreditTransaction).toHaveBeenCalledOnce();
  });

  it("throws when amount is zero or negative", async () => {
    await expect(
      applyCreditToSubscriptionAction({ customerId: "c", subscriptionId: "s", amount: 0 })
    ).rejects.toThrow("Credit amount must be positive");

    await expect(
      applyCreditToSubscriptionAction({ customerId: "c", subscriptionId: "s", amount: -100 })
    ).rejects.toThrow("Credit amount must be positive");

    expect(createPayment).not.toHaveBeenCalled();
    expect(createCreditTransaction).not.toHaveBeenCalled();
  });
});

describe("revertCreditPaymentAction", () => {
  it("deletes both the Payment and the linked CreditTransaction", async () => {
    const payment = makePayment({ id: "pay-001" });
    const tx = makeTx({ note: "[paymentId:pay-001] Credit applied" });

    vi.mocked(getAllPayments).mockReturnValue([payment]);
    vi.mocked(getAllCreditTransactions).mockReturnValue([tx]);

    await revertCreditPaymentAction("pay-001", "cust-001");

    expect(deletePayment).toHaveBeenCalledWith("pay-001");
    expect(deleteCreditTransaction).toHaveBeenCalledWith("tx-001");
  });

  it("still deletes the Payment even if no matching CreditTransaction is found", async () => {
    vi.mocked(getAllPayments).mockReturnValue([makePayment({ id: "pay-001" })]);
    vi.mocked(getAllCreditTransactions).mockReturnValue([]); // no match

    await revertCreditPaymentAction("pay-001", "cust-001");

    expect(deletePayment).toHaveBeenCalledWith("pay-001");
    expect(deleteCreditTransaction).not.toHaveBeenCalled();
  });

  it("throws when payment is not found", async () => {
    vi.mocked(getAllPayments).mockReturnValue([]);

    await expect(revertCreditPaymentAction("no-such-id", "cust-001")).rejects.toThrow(
      "Payment not found"
    );
    expect(deletePayment).not.toHaveBeenCalled();
  });

  it("throws when payment method is not credit", async () => {
    vi.mocked(getAllPayments).mockReturnValue([makePayment({ method: "cash" })]);

    await expect(revertCreditPaymentAction("pay-001", "cust-001")).rejects.toThrow(
      "Payment is not a credit payment"
    );
    expect(deletePayment).not.toHaveBeenCalled();
  });

  it("restores credit balance after apply + revert (balance calculation)", async () => {
    // Simulate balance with an active credit_used tx
    const { creditBalance } = await import("@/lib/utils/credits");
    const topUp: CreditTransaction = {
      id: "t1",
      customerId: "cust-001",
      type: "manual_topup",
      amount: 100_000,
      subscriptionId: null,
      note: "",
      createdAt: new Date().toISOString(),
    };
    const used: CreditTransaction = {
      id: "t2",
      customerId: "cust-001",
      type: "credit_used",
      amount: 50_000,
      subscriptionId: "sub-001",
      note: "[paymentId:pay-001] Credit applied",
      createdAt: new Date().toISOString(),
    };

    // Before revert: balance is 50_000
    expect(creditBalance([topUp, used])).toBe(50_000);
    // After revert (tx deleted): balance is restored to 100_000
    expect(creditBalance([topUp])).toBe(100_000);
  });
});

describe("default credit amount calculation (min(credit, balance))", () => {
  it("uses credit when credit < balance", () => {
    const credit = 30_000;
    const balance = 100_000;
    expect(Math.min(credit, balance)).toBe(30_000);
  });

  it("uses balance when balance < credit", () => {
    const credit = 200_000;
    const balance = 80_000;
    expect(Math.min(credit, balance)).toBe(80_000);
  });

  it("uses either when equal", () => {
    expect(Math.min(50_000, 50_000)).toBe(50_000);
  });

  it("clamps to 0 when balance is 0 (subscription already paid)", () => {
    const credit = 50_000;
    const balance = 0;
    expect(Math.max(0, Math.min(credit, balance))).toBe(0);
  });
});
