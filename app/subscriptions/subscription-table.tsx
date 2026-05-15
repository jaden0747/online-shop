"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTableSettings } from "@/lib/utils/use-table-settings";
import { createPaymentAction, deletePaymentAction } from "@/app/actions/payments";
import { applyCreditToSubscriptionAction, revertCreditPaymentAction } from "@/app/actions/credits";
import { createExtraAction, deleteExtraAction } from "@/app/actions/subscriptions";
import { paymentsTotalForSub, subscriptionPaymentStatus, subscriptionCompensation } from "@/lib/utils/payments";
import { calculateProratedTotalDue, formatDate, localDateStr } from "@/lib/utils/subscription";
import { PAYMENT_METHODS } from "@/lib/constants";
import { SubscriptionEndDateCell } from "@/components/subscription-end-date-cell";
import { EditSubscriptionRow } from "./edit-subscription-row";
import { CustomerOverlayTrigger } from "@/components/customer-overlay-trigger";
import { Badge } from "@/components/ui/badge";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { X, Check, ChevronDown, ChevronRight, Banknote } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import type { Payment, SubscriptionExtra, MealSkip, Subscription, CreditTransaction } from "@/lib/data/types";

type SubRow = Subscription & {
  customer: { id: string; name: string; phone: string };
  _count: { mealSkips: number };
};

type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };
type CustomerAddress = { id: string; label: string; isDefault: boolean };

function TableSettingsBar({
  zebraStripe, stickyHeader, toggle,
}: {
  zebraStripe: boolean;
  stickyHeader: boolean;
  toggle: (key: "zebraStripe" | "stickyHeader") => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-muted/20 text-xs text-muted-foreground">
      <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors">
        <input type="checkbox" checked={zebraStripe} onChange={() => toggle("zebraStripe")} className="h-3 w-3 accent-primary" />
        Zebra stripes
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors">
        <input type="checkbox" checked={stickyHeader} onChange={() => toggle("stickyHeader")} className="h-3 w-3 accent-primary" />
        Freeze header
      </label>
    </div>
  );
}

function PriceCell({ subscriptionPrice, shippingPrice, discount = 0, extrasTotal = 0 }: { subscriptionPrice: number; shippingPrice: number; discount?: number; extrasTotal?: number }) {
  const total = subscriptionPrice + shippingPrice - discount + extrasTotal;
  const parts: string[] = [];
  if (shippingPrice > 0) parts.push(`ship ${shippingPrice.toLocaleString()} VND`);
  if (discount > 0) parts.push(`−disc ${discount.toLocaleString()} VND`);
  if (extrasTotal > 0) parts.push(`+extra ${extrasTotal.toLocaleString()} VND`);
  return (
    <div>
      <span className="font-medium">{total.toLocaleString()} VND</span>
      {parts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          sub {subscriptionPrice.toLocaleString()} VND {parts.join(" ")}
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
  allCreditTransactions,
  pricingEntries,
  addressesByCustomer,
  creditBalances,
}: {
  subscriptions: SubRow[];
  allPayments: Payment[];
  allExtras: SubscriptionExtra[];
  allSkips: MealSkip[];
  allCreditTransactions: CreditTransaction[];
  pricingEntries: PricingEntry[];
  addressesByCustomer: Record<string, CustomerAddress[]>;
  creditBalances: Map<string, number>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { zebraStripe, stickyHeader, toggle } = useTableSettings();

  const sorted = [...subscriptions].sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  const seenCustomers = new Set<string>();

  return (
    <>
      <TableSettingsBar zebraStripe={zebraStripe} stickyHeader={stickyHeader} toggle={toggle} />
      <div className={stickyHeader ? "overflow-auto max-h-[70vh]" : "overflow-x-auto"}>
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className={`border-b ${stickyHeader ? "bg-muted shadow-sm" : "bg-muted/50"}`}>
              <th className="w-6" />
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-left px-4 py-2 font-medium">Period</th>
              <th className="text-left px-4 py-2 font-medium">End Date</th>
              <th className="text-left px-4 py-2 font-medium">Skips</th>
              <th className="text-left px-4 py-2 font-medium">Price</th>
              <th className="text-left px-4 py-2 font-medium">Payment</th>
              <th className="text-left px-4 py-2 font-medium">Credit</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                  No active subscriptions.
                </td>
              </tr>
            )}
            {sorted.map((sub, i) => {
              const isFirstForCustomer = !seenCustomers.has(sub.customer.id);
              seenCustomers.add(sub.customer.id);
              const subSkips = allSkips.filter((sk) => sk.subscriptionId === sub.id);
              const payStatus = subscriptionPaymentStatus(sub, allPayments, allExtras, subSkips, allCreditTransactions);
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
                  allCreditTransactions={allCreditTransactions}
                  pricingEntries={pricingEntries}
                  customerAddresses={addressesByCustomer[sub.customerId] ?? []}
                  extrasTotal={subExtrasTotal}
                  customerCredit={creditBalances.get(sub.customerId) ?? 0}
                  colSpan={10}
                  showEndDate
                  isFirstForCustomer={isFirstForCustomer}
                  isEven={zebraStripe && i % 2 !== 0}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function InactiveSubscriptionTable({
  subscriptions,
  allPayments,
  allExtras,
  allSkips,
  allCreditTransactions,
  pricingEntries,
  creditBalances,
}: {
  subscriptions: SubRow[];
  allPayments: Payment[];
  allExtras: SubscriptionExtra[];
  allSkips: MealSkip[];
  allCreditTransactions: CreditTransaction[];
  pricingEntries: PricingEntry[];
  creditBalances: Map<string, number>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { zebraStripe, stickyHeader, toggle } = useTableSettings();

  const sorted = [...subscriptions].sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  const seenCustomers = new Set<string>();

  return (
    <>
      <TableSettingsBar zebraStripe={zebraStripe} stickyHeader={stickyHeader} toggle={toggle} />
      <div className={stickyHeader ? "overflow-auto max-h-[70vh]" : "overflow-x-auto"}>
        <table className="w-full text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : ""}>
            <tr className={`border-b ${stickyHeader ? "bg-muted shadow-sm" : "bg-muted/50"}`}>
              <th className="w-6" />
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-left px-4 py-2 font-medium">Period</th>
              <th className="text-left px-4 py-2 font-medium">Skips</th>
              <th className="text-left px-4 py-2 font-medium">Price</th>
              <th className="text-left px-4 py-2 font-medium">Payment</th>
              <th className="text-left px-4 py-2 font-medium">Credit</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                  No inactive subscriptions.
                </td>
              </tr>
            )}
            {sorted.map((sub, i) => {
              const isFirstForCustomer = !seenCustomers.has(sub.customer.id);
              seenCustomers.add(sub.customer.id);
              const subSkips = allSkips.filter((sk) => sk.subscriptionId === sub.id);
              const payStatus = subscriptionPaymentStatus(sub, allPayments, allExtras, subSkips, allCreditTransactions);
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
                  allCreditTransactions={allCreditTransactions}
                  pricingEntries={pricingEntries}
                  customerAddresses={[]}
                  extrasTotal={subExtrasTotal}
                  customerCredit={creditBalances.get(sub.customerId) ?? 0}
                  colSpan={10}
                  showEndDate={false}
                  isFirstForCustomer={isFirstForCustomer}
                  isEven={zebraStripe && i % 2 !== 0}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function QuickPayButton({
  subscriptionId,
  balance,
}: {
  subscriptionId: string;
  balance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Payment["method"]>("transfer");
  const [amount, setAmount] = useState(balance > 0 ? balance : 0);
  const [saving, startSave] = useTransition();

  function handleOpen(o: boolean) {
    if (o) setAmount(balance > 0 ? balance : 0);
    setOpen(o);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!amount || amount <= 0) return;
    startSave(async () => {
      await createPaymentAction({
        subscriptionId,
        type: "payment",
        amount,
        paidAt: localDateStr(new Date()),
        method,
        note: null,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title="Quick log payment"
            className="h-5 w-5 rounded flex items-center justify-center bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
          />
        }
      >
        <Banknote size={11} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6}>
          <Popover.Popup
            className="z-50 w-56 rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-lg p-3 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-muted-foreground">Quick Log Payment</p>
            <form onSubmit={handleSubmit} className="space-y-2">
              <FormattedAmountInput
                value={amount}
                onChange={(v) => setAmount(Number(v) || 0)}
                className="h-7 text-xs"
              />
              <div className="flex gap-1 flex-wrap">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={[
                      "px-2 py-0.5 rounded-full text-xs font-medium border transition-colors",
                      method === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-foreground/40",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={saving || amount <= 0}
                className="w-full h-7 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 transition-opacity"
              >
                {saving ? "Saving…" : `Log ${amount.toLocaleString()} VND`}
              </button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
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
  allCreditTransactions,
  pricingEntries,
  customerAddresses,
  extrasTotal,
  customerCredit,
  colSpan,
  showEndDate,
  isFirstForCustomer = true,
  isEven = false,
}: {
  sub: SubRow;
  payStatus: ReturnType<typeof subscriptionPaymentStatus>;
  isExpanded: boolean;
  onToggle: () => void;
  allPayments: Payment[];
  allExtras: SubscriptionExtra[];
  allSkips: MealSkip[];
  allCreditTransactions: CreditTransaction[];
  pricingEntries: PricingEntry[];
  customerAddresses: CustomerAddress[];
  extrasTotal: number;
  customerCredit: number;
  colSpan: number;
  showEndDate: boolean;
  isFirstForCustomer?: boolean;
  isEven?: boolean;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const subPayments = allPayments.filter((p) => p.subscriptionId === sub.id);
  const { paid, refunded } = paymentsTotalForSub(allPayments, sub.id);
  const subSkips = allSkips.filter((sk) => sk.subscriptionId === sub.id);
  const subExtras = allExtras.filter((e) => e.subscriptionId === sub.id);
  const compensation = subscriptionCompensation(sub.id, allPayments, allCreditTransactions);
  const isCancelled = sub.status === "cancelled";
  const totalDue = isCancelled
    ? calculateProratedTotalDue(sub, subSkips, subExtras)
    : sub.subscriptionPrice + sub.shippingPrice - sub.discount + extrasTotal;
  const balance = totalDue - compensation.netEarned;

  function handleMarkPaid(e: React.MouseEvent) {
    e.stopPropagation();
    if (balance <= 0) return;
    startSave(async () => {
      await createPaymentAction({
        subscriptionId: sub.id,
        type: "payment",
        amount: balance,
        paidAt: localDateStr(new Date()),
        method: "transfer",
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
        className={`hover:bg-accent/50 transition-colors cursor-pointer ${isExpanded ? "bg-accent/30" : isEven ? "bg-muted/25" : ""}`}
        onClick={onToggle}
      >
        <td className="pl-2 py-2 text-muted-foreground">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-4 py-2">
          {isFirstForCustomer ? (
            <div onClick={(e) => e.stopPropagation()}>
              <CustomerOverlayTrigger
                customerId={sub.customer.id}
                name={sub.customer.name}
                phone={sub.customer.phone}
              />
            </div>
          ) : (
            <span className="text-muted-foreground/40 text-xs pl-2">↳</span>
          )}
        </td>
        <td className="px-4 py-2 capitalize text-muted-foreground">
          {sub.plan} · {sub.goal} · {sub.mealsPerDay}×/day
        </td>
        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
          {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
        </td>
        {showEndDate && (
          <td className="px-4 py-2">
            <SubscriptionEndDateCell endDate={sub.endDate} />
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
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{compensation.netEarned.toLocaleString()} VND</span>
              <span className={[
                "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                payStatus.status === "paid" ? "bg-green-100 text-green-800" :
                payStatus.status === "partial" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-700",
              ].join(" ")}>{payStatus.status}</span>
              {payStatus.status !== "paid" && (
                <QuickPayButton subscriptionId={sub.id} balance={balance} />
              )}
            </div>
            {isCancelled && payStatus.status === "paid" && Math.abs(payStatus.residual) > 1 && (
              <p className={`text-[10px] mt-0.5 ${payStatus.residual < 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {payStatus.residual < 0
                  ? `${Math.abs(payStatus.residual).toLocaleString()} VND refund owed`
                  : `${payStatus.residual.toLocaleString()} VND over-refunded`}
              </p>
            )}
            {compensation.cashRefunded > 0 && (
              <p className="text-xs text-red-500 mt-0.5">−{compensation.cashRefunded.toLocaleString()} VND refunded</p>
            )}
            {compensation.refundedToCredit > 0 && (
              <p className="text-[10px] text-emerald-600 mt-0.5">−{compensation.refundedToCredit.toLocaleString()} VND → credit</p>
            )}
          </div>
        </td>
        <td className="px-4 py-2">
          {customerCredit > 0 ? (
            <span className="text-xs font-medium text-emerald-600">{customerCredit.toLocaleString()} VND</span>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          )}
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
              extras={subExtras}
              totalDue={totalDue}
              paid={paid}
              refunded={refunded}
              refundedToCredit={compensation.refundedToCredit}
              balance={balance}
              customerCredit={customerCredit}
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
  extras,
  totalDue,
  paid,
  refunded,
  refundedToCredit,
  balance,
  customerCredit,
}: {
  sub: SubRow;
  payments: Payment[];
  extras: SubscriptionExtra[];
  totalDue: number;
  paid: number;
  refunded: number;
  refundedToCredit: number;
  balance: number;
  customerCredit: number;
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
    method: "transfer",
    note: "",
  });
  const [creditAmount, setCreditAmount] = useState(String(Math.min(customerCredit, Math.max(0, balance))));
  const [creditWarning, setCreditWarning] = useState<string | null>(null);

  function handleRecord() {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    startSave(async () => {
      await createPaymentAction({
        subscriptionId: sub.id,
        type: form.type,
        amount: amt,
        paidAt: form.paidAt,
        method: form.method,
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

  function handleApplyCredit() {
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0) return;
    startSave(async () => {
      const { warning } = await applyCreditToSubscriptionAction({
        customerId: sub.customerId,
        subscriptionId: sub.id,
        amount: amt,
        note: "Credit applied",
      });
      setCreditWarning(warning);
      router.refresh();
    });
  }

  function handleRevertCredit(paymentId: string) {
    startSave(async () => {
      await revertCreditPaymentAction(paymentId, sub.customerId);
      router.refresh();
    });
  }

  const [extraNote, setExtraNote] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraForDate, setExtraForDate] = useState("");

  function handleAddExtra() {
    const amount = parseFloat(extraAmount);
    if (!amount) return;
    startSave(async () => {
      const fd = new FormData();
      fd.set("subscriptionId", sub.id);
      fd.set("amount", String(amount));
      fd.set("note", extraNote.trim());
      if (extraForDate) fd.set("forDate", extraForDate);
      await createExtraAction(fd);
      setExtraNote("");
      setExtraAmount("");
      setExtraForDate("");
      router.refresh();
    });
  }

  function handleDeleteExtra(id: string) {
    startSave(async () => {
      await deleteExtraAction(id);
      router.refresh();
    });
  }

  const inp = "border rounded px-2 py-1 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="max-w-2xl space-y-3">
      {/* Cancellation info */}
      {sub.status === "cancelled" && (sub.cancelledAt || sub.cancelReason) && (
        <div className="text-xs text-muted-foreground flex items-center gap-3">
          {sub.cancelledAt && (
            <span>Cancelled: <span className="font-medium text-foreground">{new Date(sub.cancelledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></span>
          )}
          {sub.cancelReason && (
            <span>Reason: <span className="font-medium text-foreground">{sub.cancelReason}</span></span>
          )}
        </div>
      )}
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        <div>
          <span className="text-muted-foreground">Due </span>
          <span className="font-medium">{totalDue.toLocaleString()} VND</span>
        </div>
        <div>
          <span className="text-muted-foreground">Paid </span>
          <span className="font-medium text-green-700 dark:text-green-400">{paid.toLocaleString()} VND</span>
        </div>
        {refunded > 0 && (
          <div>
            <span className="text-muted-foreground">Refunded </span>
            <span className="font-medium text-yellow-600">{refunded.toLocaleString()} VND</span>
          </div>
        )}
        {refundedToCredit > 0 && (
          <div>
            <span className="text-muted-foreground">→ Credit </span>
            <span className="font-medium text-emerald-600">{refundedToCredit.toLocaleString()} VND</span>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">
            {sub.status === "cancelled" && balance < 0 ? "Refund owed " : balance >= 0 ? "Balance " : "Overpaid "}
          </span>
          <span className={`font-medium ${balance > 0 ? "text-red-600" : balance < 0 ? "text-amber-600" : "text-green-700"}`}>
            {Math.abs(balance).toLocaleString()} VND
          </span>
        </div>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs group">
              <span className={`font-medium ${p.type === "refund" ? "text-yellow-600" : "text-green-700"}`}>
                {p.type === "refund" ? "−" : "+"}{p.amount.toLocaleString()} VND
              </span>
              {p.method === "credit" ? (
                <span className="px-1.5 py-px rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-medium">credit</span>
              ) : (
                <>
                  <span className="text-muted-foreground">{p.type}</span>
                  {p.method !== "other" && <span className="text-muted-foreground">· {p.method}</span>}
                </>
              )}
              <span className="text-muted-foreground">{p.paidAt.slice(0, 10)}</span>
              {p.note && p.method !== "credit" && <span className="text-muted-foreground truncate max-w-[200px]">{p.note}</span>}
              {p.method === "credit" ? (
                <button
                  type="button"
                  title="Undo credit payment"
                  onClick={() => handleRevertCredit(p.id)}
                  disabled={saving}
                  className="ml-auto h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-amber-600 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  ↩
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={saving}
                  className="ml-auto h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Extras / Addons */}
      <div className="border-t pt-2 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Extras / Addons</span>
          {extras.length > 0 && (
            <span className="text-amber-600 font-medium">
              +{extras.reduce((s, e) => s + e.amount, 0).toLocaleString()} VND
            </span>
          )}
        </div>
        {extras.length > 0 && (
          <div className="space-y-0.5">
            {extras.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs group">
                <span className="font-medium text-amber-600">+{e.amount.toLocaleString()} VND</span>
                {e.startDate && <span className="text-muted-foreground">{localDateStr(new Date(e.startDate))}{e.endDate && e.endDate !== e.startDate ? ` – ${localDateStr(new Date(e.endDate))}` : ""}</span>}
                {e.note && <span className="text-muted-foreground flex-1 truncate">{e.note}</span>}
                <button
                  type="button"
                  onClick={() => handleDeleteExtra(e.id)}
                  disabled={saving}
                  className="ml-auto h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-50"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className={`${inp} flex-1 min-w-[120px]`}
            type="text"
            placeholder="Note (e.g. extra protein)"
            value={extraNote}
            onChange={(e) => setExtraNote(e.target.value)}
          />
          <FormattedAmountInput
            className={`${inp} w-28`}
            placeholder="₫ Amount"
            value={extraAmount}
            onChange={(raw) => setExtraAmount(raw)}
          />
          <input
            className={`${inp} w-32`}
            type="date"
            title="Delivery date for this extra (optional)"
            value={extraForDate}
            onChange={(e) => setExtraForDate(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAddExtra}
            disabled={saving || !extraAmount}
            className="px-3 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Add Extra
          </button>
        </div>
      </div>

      {/* Record form */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className={`${inp} w-24`} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Payment["type"] }))}>
          <option value="payment">Payment</option>
          <option value="refund">Refund</option>
        </select>
        <select className={`${inp} w-24`} value={form.method} onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as Payment["method"] }))}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <FormattedAmountInput className={`${inp} w-28`} placeholder="Amount (₫)" value={form.amount}
          onChange={(raw) => setForm((p) => ({ ...p, amount: raw }))} />
        <input className={`${inp} w-36`} type="date" value={form.paidAt}
          onChange={(e) => setForm((p) => ({ ...p, paidAt: e.target.value }))} />
        <input className={`${inp} flex-1 min-w-[100px]`} type="text" placeholder="Note (optional)" value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
        <button type="button" onClick={handleRecord} disabled={saving || !form.amount}
          className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          Record
        </button>
      </div>

      {/* Apply credit */}
      {customerCredit > 0 && balance > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            {customerCredit.toLocaleString()} VND credit available
          </span>
          <FormattedAmountInput className={`${inp} w-28`} placeholder="Apply amount" value={creditAmount}
            onChange={(raw) => setCreditAmount(raw)} />
          <button type="button" onClick={handleApplyCredit} disabled={saving || !creditAmount}
            className="px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            Apply Credit
          </button>
          {creditWarning && <span className="text-amber-600 text-[10px]">{creditWarning}</span>}
        </div>
      )}
    </div>
  );
}
