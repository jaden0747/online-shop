"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentAction, deletePaymentAction } from "@/app/actions/payments";
import { paymentsTotalForSub, subscriptionPaymentStatus } from "@/lib/utils/payments";
import { daysRemaining, formatDate } from "@/lib/utils/subscription";
import { EditSubscriptionRow } from "./edit-subscription-row";
import { CustomerOverlayTrigger } from "@/components/customer-overlay-trigger";
import { Badge } from "@/components/ui/badge";
import { X, Check, ChevronDown, ChevronRight } from "lucide-react";
import type { Payment, SubscriptionExtra, MealSkip, Subscription } from "@/lib/data/types";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PAYMENT_METHODS: Payment["method"][] = ["cash", "transfer", "momo", "other"];

type SubRow = Subscription & {
  customer: { id: string; name: string; phone: string };
  _count: { mealSkips: number };
};

type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };
type CustomerAddress = { id: string; label: string; isDefault: boolean };

function EndDateCell({ endDate }: { endDate: string }) {
  const days = daysRemaining(endDate);
  let textClass: string;
  let barClass: string;
  if (days >= 14) { textClass = "text-green-600"; barClass = "bg-green-500"; }
  else if (days >= 7) { textClass = "text-yellow-600"; barClass = "bg-yellow-500"; }
  else if (days >= 3) { textClass = "text-orange-600"; barClass = "bg-orange-500"; }
  else { textClass = "text-red-600"; barClass = "bg-red-500"; }
  const fillPct = Math.min(100, Math.round((days / 14) * 100));
  return (
    <div className="min-w-[70px]">
      <span className={`text-xs font-medium ${textClass}`}>{days} days</span>
      <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
        <div className={`h-1 rounded-full ${barClass}`} style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}

function PriceCell({ subscriptionPrice, shippingPrice, discount = 0, extrasTotal = 0 }: { subscriptionPrice: number; shippingPrice: number; discount?: number; extrasTotal?: number }) {
  const total = subscriptionPrice + shippingPrice - discount + extrasTotal;
  const parts: string[] = [];
  if (shippingPrice > 0) parts.push(`ship ₫${shippingPrice.toLocaleString()}`);
  if (discount > 0) parts.push(`−disc ₫${discount.toLocaleString()}`);
  if (extrasTotal > 0) parts.push(`+extra ₫${extrasTotal.toLocaleString()}`);
  return (
    <div>
      <span className="font-medium">₫{total.toLocaleString()}</span>
      {parts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          sub ₫{subscriptionPrice.toLocaleString()} {parts.join(" ")}
        </p>
      )}
    </div>
  );
}

export function ActiveSubscriptionTable({
  subscriptions,
  allPayments,
  allExtras,
  allSkips,
  pricingEntries,
  addressesByCustomer,
}: {
  subscriptions: SubRow[];
  allPayments: Payment[];
  allExtras: SubscriptionExtra[];
  allSkips: MealSkip[];
  pricingEntries: PricingEntry[];
  addressesByCustomer: Record<string, CustomerAddress[]>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/50">
          <th className="w-6" />
          <th className="text-left px-4 py-2 font-medium">Customer</th>
          <th className="text-left px-4 py-2 font-medium">Plan</th>
          <th className="text-left px-4 py-2 font-medium">Period</th>
          <th className="text-left px-4 py-2 font-medium">End Date</th>
          <th className="text-left px-4 py-2 font-medium">Skips</th>
          <th className="text-left px-4 py-2 font-medium">Price</th>
          <th className="text-left px-4 py-2 font-medium">Payment</th>
          <th className="w-10" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {subscriptions.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
              No active subscriptions.
            </td>
          </tr>
        )}
        {subscriptions.map((sub) => {
          const payStatus = subscriptionPaymentStatus(sub, allPayments, allExtras);
          const isExpanded = expandedId === sub.id;
          const subExtrasTotal = allExtras.filter((e) => e.subscriptionId === sub.id).reduce((s, e) => s + e.amount, 0);
          return (
            <ExpandableRow
              key={sub.id}
              sub={sub}
              payStatus={payStatus}
              isExpanded={isExpanded}
              onToggle={() => setExpandedId(isExpanded ? null : sub.id)}
              allPayments={allPayments}
              allExtras={allExtras}
              allSkips={allSkips}
              pricingEntries={pricingEntries}
              customerAddresses={addressesByCustomer[sub.customerId] ?? []}
              extrasTotal={subExtrasTotal}
              colSpan={9}
              showEndDate
            />
          );
        })}
      </tbody>
    </table>
  );
}

export function InactiveSubscriptionTable({
  subscriptions,
  allPayments,
  allExtras,
  allSkips,
  pricingEntries,
}: {
  subscriptions: SubRow[];
  allPayments: Payment[];
  allExtras: SubscriptionExtra[];
  allSkips: MealSkip[];
  pricingEntries: PricingEntry[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/50">
          <th className="w-6" />
          <th className="text-left px-4 py-2 font-medium">Customer</th>
          <th className="text-left px-4 py-2 font-medium">Plan</th>
          <th className="text-left px-4 py-2 font-medium">Period</th>
          <th className="text-left px-4 py-2 font-medium">Skips</th>
          <th className="text-left px-4 py-2 font-medium">Price</th>
          <th className="text-left px-4 py-2 font-medium">Payment</th>
          <th className="text-left px-4 py-2 font-medium">Status</th>
          <th className="w-10" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {subscriptions.length === 0 && (
          <tr>
            <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
              No inactive subscriptions.
            </td>
          </tr>
        )}
        {subscriptions.map((sub) => {
          const payStatus = subscriptionPaymentStatus(sub, allPayments, allExtras);
          const isExpanded = expandedId === sub.id;
          const subExtrasTotal = allExtras.filter((e) => e.subscriptionId === sub.id).reduce((s, e) => s + e.amount, 0);
          return (
            <ExpandableRow
              key={sub.id}
              sub={sub}
              payStatus={payStatus}
              isExpanded={isExpanded}
              onToggle={() => setExpandedId(isExpanded ? null : sub.id)}
              allPayments={allPayments}
              allExtras={allExtras}
              allSkips={allSkips}
              pricingEntries={pricingEntries}
              customerAddresses={[]}
              extrasTotal={subExtrasTotal}
              colSpan={9}
              showEndDate={false}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function ExpandableRow({
  sub,
  payStatus,
  isExpanded,
  onToggle,
  allPayments,
  allExtras,
  allSkips,
  pricingEntries,
  customerAddresses,
  extrasTotal,
  colSpan,
  showEndDate,
}: {
  sub: SubRow;
  payStatus: "paid" | "partial" | "unpaid";
  isExpanded: boolean;
  onToggle: () => void;
  allPayments: Payment[];
  allExtras: SubscriptionExtra[];
  allSkips: MealSkip[];
  pricingEntries: PricingEntry[];
  customerAddresses: CustomerAddress[];
  extrasTotal: number;
  colSpan: number;
  showEndDate: boolean;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const subPayments = allPayments.filter((p) => p.subscriptionId === sub.id);
  const { paid, refunded, net } = paymentsTotalForSub(allPayments, sub.id);
  const totalDue = sub.subscriptionPrice + sub.shippingPrice - sub.discount + extrasTotal;
  const balance = totalDue - net;
  const subSkips = allSkips.filter((sk) => sk.subscriptionId === sub.id);
  const subExtras = allExtras.filter((e) => e.subscriptionId === sub.id);

  function handleMarkPaid(e: React.MouseEvent) {
    e.stopPropagation();
    if (balance <= 0) return;
    startSave(async () => {
      await createPaymentAction({
        subscriptionId: sub.id,
        type: "payment",
        amount: balance,
        paidAt: localDateStr(new Date()),
        method: "other",
        note: null,
      });
      router.refresh();
    });
  }

  const derivedStatus = sub.status === "cancelled" ? "cancelled" :
    new Date(sub.endDate) < new Date() ? "expired" :
    new Date(sub.startDate) > new Date() ? "upcoming" : "active";

  return (
    <>
      <tr
        className={`hover:bg-accent/50 transition-colors cursor-pointer ${isExpanded ? "bg-accent/30" : ""}`}
        onClick={onToggle}
      >
        <td className="pl-2 py-2 text-muted-foreground">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-2">
          <div onClick={(e) => e.stopPropagation()}>
            <CustomerOverlayTrigger
              customerId={sub.customer.id}
              name={sub.customer.name}
              phone={sub.customer.phone}
            />
          </div>
        </td>
        <td className="px-4 py-2 capitalize text-muted-foreground">
          {sub.plan} · {sub.goal} · {sub.mealsPerDay}×/day
        </td>
        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
          {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
        </td>
        {showEndDate && (
          <td className="px-4 py-2">
            <EndDateCell endDate={sub.endDate} />
          </td>
        )}
        <td className="px-4 py-2">{sub._count.mealSkips > 0 ? sub._count.mealSkips : "—"}</td>
        <td className="px-4 py-2">
          <PriceCell
            subscriptionPrice={sub.subscriptionPrice}
            shippingPrice={sub.shippingPrice}
            discount={sub.discount}
            extrasTotal={extrasTotal}
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className={[
              "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              payStatus === "paid" ? "bg-green-100 text-green-800" :
              payStatus === "partial" ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-700",
            ].join(" ")}>{payStatus}</span>
            {payStatus !== "paid" && (
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={saving}
                title={`Mark as paid (₫${balance.toLocaleString()})`}
                className="h-5 w-5 rounded flex items-center justify-center bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
              >
                <Check size={11} strokeWidth={3} />
              </button>
            )}
          </div>
        </td>
        {!showEndDate && (
          <td className="px-4 py-2">
            <Badge variant={derivedStatus === "upcoming" ? "secondary" : "outline"}>
              {derivedStatus}
            </Badge>
          </td>
        )}
        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <EditSubscriptionRow
            sub={{ ...sub, startDate: String(sub.startDate), endDate: String(sub.endDate) }}
            pricing={pricingEntries}
            extras={subExtras}
            customerAddresses={customerAddresses}
            skips={subSkips}
            payments={subPayments}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3 bg-muted/20 border-b">
            <PaymentExpandedPanel
              sub={sub}
              payments={subPayments}
              totalDue={totalDue}
              paid={paid}
              refunded={refunded}
              net={net}
              balance={balance}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function PaymentExpandedPanel({
  sub,
  payments,
  totalDue,
  paid,
  refunded,
  net,
  balance,
}: {
  sub: SubRow;
  payments: Payment[];
  totalDue: number;
  paid: number;
  refunded: number;
  net: number;
  balance: number;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [form, setForm] = useState<{
    type: Payment["type"];
    amount: string;
    paidAt: string;
    method: Payment["method"];
    note: string;
  }>({
    type: "payment",
    amount: balance > 0 ? String(balance) : "",
    paidAt: localDateStr(new Date()),
    method: "cash",
    note: "",
  });

  function handleRecord() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    startSave(async () => {
      await createPaymentAction({
        subscriptionId: sub.id,
        type: form.type,
        amount: amt,
        paidAt: form.paidAt,
        method: form.type === "payment" ? "other" : form.method,
        note: form.note.trim() || null,
      });
      setForm((p) => ({ ...p, note: "" }));
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startSave(async () => {
      await deletePaymentAction(id);
      router.refresh();
    });
  }

  const inp = "border rounded px-2 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="max-w-2xl space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        <div>
          <span className="text-muted-foreground">Due </span>
          <span className="font-medium">₫{totalDue.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Paid </span>
          <span className="font-medium text-green-700 dark:text-green-400">₫{paid.toLocaleString()}</span>
        </div>
        {refunded > 0 && (
          <div>
            <span className="text-muted-foreground">Refunded </span>
            <span className="font-medium text-yellow-600">₫{refunded.toLocaleString()}</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">{balance >= 0 ? "Balance " : "Overpaid "}</span>
          <span className={`font-medium ${balance > 0 ? "text-red-600" : balance < 0 ? "text-yellow-600" : "text-green-700"}`}>
            ₫{Math.abs(balance).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs group">
              <span className={`font-medium ${p.type === "refund" ? "text-yellow-600" : "text-green-700"}`}>
                {p.type === "refund" ? "−" : "+"}₫{p.amount.toLocaleString()}
              </span>
              <span className="text-muted-foreground">{p.type}</span>
              {p.method !== "other" && <span className="text-muted-foreground">· {p.method}</span>}
              <span className="text-muted-foreground">{p.paidAt.slice(0, 10)}</span>
              {p.note && <span className="text-muted-foreground truncate max-w-[200px]">{p.note}</span>}
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={saving}
                className="ml-auto h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Record form */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className={`${inp} w-24`} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Payment["type"] }))}>
          <option value="payment">Payment</option>
          <option value="refund">Refund</option>
        </select>
        {form.type === "refund" && (
          <select className={`${inp} w-24`} value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as Payment["method"] }))}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <input className={`${inp} w-28`} type="number" step="1000" placeholder="Amount (₫)" value={form.amount}
          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
        <input className={`${inp} w-36`} type="date" value={form.paidAt}
          onChange={(e) => setForm((p) => ({ ...p, paidAt: e.target.value }))} />
        <input className={`${inp} flex-1 min-w-[100px]`} type="text" placeholder="Note (optional)" value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
        <button type="button" onClick={handleRecord} disabled={saving || !form.amount}
          className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          Record
        </button>
      </div>
    </div>
  );
}
