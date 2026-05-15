"use client";

import { forwardRef, useImperativeHandle, useState, useTransition } from "react";
import {
  updateSubscriptionStatusAction,
  deleteSubscriptionAction,
} from "@/app/actions/subscriptions";
import { subscriptionStatus, daysRemaining, isSubscriptionLive } from "@/lib/utils/subscription";
import type {
  Subscription,
  SubscriptionExtra,
  MealSkip,
  Payment,
  CreditTransaction,
  Pricing,
} from "@/lib/data/types";
import type { SectionRef } from "./section-ref";
import { SubForm } from "./sub-form";
import { ExtrasPanel } from "./extras-panel";
import { PaymentPanel } from "./payment-panel";
import { CancelSubscriptionForm } from "../cancel-subscription-form";
import { Pencil, Plus, Trash2 } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function creditBalance(creditTransactions: CreditTransaction[]) {
  return creditTransactions.reduce((acc, t) => {
    if (
      t.type === "refund_credit" ||
      t.type === "manual_topup" ||
      t.type === "adjustment"
    )
      return acc + t.amount;
    if (t.type === "credit_used") return acc - t.amount;
    return acc;
  }, 0);
}

export const SubscriptionSection = forwardRef<
  SectionRef,
  {
    subscriptions: Subscription[];
    customerId: string;
    creditTransactions: CreditTransaction[];
    pricing: Pricing[];
    mealPrices: Record<string, number>;
    skips: MealSkip[];
    skipCounts: Record<string, number>;
    payments: Payment[];
    extras: SubscriptionExtra[];
    onPaymentCreated: (payment: Payment) => void;
    onPaymentDeleted: (paymentId: string) => void;
    onSubscriptionCancelled: (result?: {
      subscription: Subscription | null;
      payment?: Payment;
      creditTransaction?: CreditTransaction;
    }) => void;
    onReload: () => void;
  }
>(function SubscriptionSection(
  {
    subscriptions,
    customerId,
    creditTransactions,
    pricing,
    mealPrices,
    skips,
    skipCounts,
    payments,
    extras,
    onPaymentCreated,
    onPaymentDeleted,
    onSubscriptionCancelled,
    onReload,
  },
  ref
) {
  const [showAddSub, setShowAddSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useImperativeHandle(ref, () => ({
    closeOpenForm: () => {
      if (showAddSub) {
        setShowAddSub(false);
        return true;
      }
      if (editingSubId !== null) {
        setEditingSubId(null);
        return true;
      }
      if (cancellingId !== null) {
        setCancellingId(null);
        return true;
      }
      return false;
    },
    reset: () => {
      setShowAddSub(false);
      setEditingSubId(null);
      setCancellingId(null);
    },
  }));

  function handleRecover(id: string) {
    startTransition(async () => {
      await updateSubscriptionStatusAction(id, "active");
      onReload();
    });
  }

  function handleDeleteSubscription(id: string) {
    if (
      !window.confirm(
        "Permanently delete this subscription? This action cannot be undone."
      )
    )
      return;
    startTransition(async () => {
      await deleteSubscriptionAction(id);
      onReload();
    });
  }

  const creditBal = creditBalance(creditTransactions);
  const today = new Date();

  const sorted = [...subscriptions].sort((a, b) => {
    const liveRank = (s: Subscription) =>
      isSubscriptionLive(s.status, s.startDate, s.endDate, today) ? 0 : 1;
    const r = liveRank(a) - liveRank(b);
    return r !== 0 ? r : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Subscriptions
        </p>
        {!showAddSub && (
          <button
            type="button"
            onClick={() => {
              setShowAddSub(true);
              setEditingSubId(null);
            }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={11} /> New
          </button>
        )}
      </div>

      {showAddSub && (
        <SubForm
          mode="create"
          customerId={customerId}
          pricing={pricing}
          mealPrices={mealPrices}
          creditBalance={creditBal}
          onSaved={() => {
            setShowAddSub(false);
            onReload();
          }}
          onCancel={() => setShowAddSub(false)}
        />
      )}

      {!showAddSub && editingSubId && (() => {
        const editingSub = subscriptions.find((s) => s.id === editingSubId);
        return editingSub ? (
          <SubForm
            mode="edit"
            subId={editingSub.id}
            customerId={customerId}
            pricing={pricing}
            mealPrices={mealPrices}
            initial={editingSub}
            skips={skips.filter((s) => s.subscriptionId === editingSub.id)}
            onSaved={() => {
              setEditingSubId(null);
              onReload();
            }}
            onCancel={() => setEditingSubId(null)}
          />
        ) : null;
      })()}

      {subscriptions.length === 0 && !showAddSub && !editingSubId && (
        <p className="text-xs text-muted-foreground/50">No subscriptions.</p>
      )}

      <div className="max-h-[380px] overflow-y-auto pr-1">
        <ul className="space-y-1">
          {sorted.map((sub) => {
            const status = subscriptionStatus(sub.status, sub.startDate, sub.endDate);
            const days = daysRemaining(sub.endDate);
            const subSkips = skipCounts[sub.id] ?? 0;
            const canAct = sub.status === "active";
            const isCancelling = cancellingId === sub.id;
            return (
              <li key={sub.id} className="border rounded px-2 py-1 text-[11px]">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium capitalize">{sub.plan}</span>
                    <span
                      className={[
                        "px-1 py-0.5 rounded-full text-[9px] shrink-0",
                        status === "active"
                          ? "bg-green-100 text-green-800"
                          : status === "upcoming"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      {status}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {sub.goal}·{sub.mealsPerDay}×/day
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubId(sub.id);
                        setShowAddSub(false);
                        setCancellingId(null);
                      }}
                      className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <Pencil size={9} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubscription(sub.id)}
                      disabled={isPending}
                      className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>

                {!isCancelling && (
                  <div className="flex items-center justify-between text-muted-foreground mt-0.5">
                    <span className="truncate">
                      <span>
                        {(
                          sub.subscriptionPrice +
                          sub.shippingPrice -
                          sub.discount
                        ).toLocaleString()}{" "}
                        VND
                        {sub.discount > 0 && (
                          <span className="text-[9px]">
                            {" "}
                            (-{sub.discount.toLocaleString()} VND)
                          </span>
                        )}{" "}
                        ·{" "}
                      </span>
                      Ends {fmt(sub.endDate)}
                      {status === "active" && ` · ${days}d`}
                      {subSkips > 0 && ` · ${subSkips} skip${subSkips !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                )}

                {!isCancelling &&
                  sub.status === "cancelled" &&
                  (sub.cancelledAt || sub.cancelReason) && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-1.5 flex-wrap">
                      {sub.cancelledAt && (
                        <span>
                          Cancelled{" "}
                          {new Date(sub.cancelledAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {sub.cancelReason && <span>· {sub.cancelReason}</span>}
                    </div>
                  )}

                {canAct && !isCancelling && (
                  <div className="flex gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingId(sub.id);
                        setEditingSubId(null);
                      }}
                      disabled={isPending}
                      className="px-1.5 py-0.5 text-[10px] rounded border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {sub.status === "cancelled" && (
                  <div className="flex gap-1 mt-0.5">
                    <button
                      type="button"
                      onClick={() => handleRecover(sub.id)}
                      disabled={isPending}
                      className="px-1.5 py-0.5 text-[10px] rounded border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      Recover
                    </button>
                  </div>
                )}

                {isCancelling && (
                  <div className="pt-0.5">
                    <CancelSubscriptionForm
                      sub={sub}
                      customerId={customerId}
                      skips={skips.filter((s) => s.subscriptionId === sub.id)}
                      payments={payments.filter((p) => p.subscriptionId === sub.id)}
                      extras={extras.filter((e) => e.subscriptionId === sub.id)}
                      onDone={(result) => {
                        setCancellingId(null);
                        onSubscriptionCancelled(result);
                      }}
                      onCancel={() => setCancellingId(null)}
                    />
                  </div>
                )}

                <ExtrasPanel
                  sub={sub}
                  extras={extras.filter((e) => e.subscriptionId === sub.id)}
                  onReload={onReload}
                />
                <PaymentPanel
                  sub={sub}
                  payments={payments}
                  extras={extras}
                  skips={skips.filter((s) => s.subscriptionId === sub.id)}
                  creditTransactions={creditTransactions}
                  customerId={customerId}
                  customerCredit={creditBal}
                  onReload={onReload}
                  onPaymentCreated={onPaymentCreated}
                  onPaymentDeleted={onPaymentDeleted}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
});
