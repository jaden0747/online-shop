"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSubscriptionAction, createExtraAction, deleteExtraAction } from "../actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addWorkingDays } from "@/lib/utils/subscription";
import {
  defaultWeeklySchedule,
  parseWeeklySchedule,
  serializeWeeklySchedule,
  weeklyScheduleTotal,
  validateWeeklySchedule,
} from "@/lib/utils/schedule";
import type { WeeklyMealSchedule } from "@/lib/data/types";
import { CancelSubscriptionForm } from "@/components/cancel-subscription-form";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { MealSkip, Payment, SubscriptionExtra } from "@/lib/data/types";

const DAY_LABELS: [keyof WeeklyMealSchedule, string][] = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"],
];

type Sub = {
  id: string;
  customerId: string;
  plan: string;
  goal: string;
  status: string;
  mealsPerDay: number;
  weeklyScheduleJson?: string | null;
  subscriptionPrice: number;
  shippingPrice: number;
  discount: number;
  trialDays: number | null;
  startDate: string;
  endDate: string;
  endDateNoSkip: string;
  addressId: string | null;
};

type CustomerAddress = { id: string; label: string; isDefault: boolean };

type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };

type Extra = SubscriptionExtra;

type PendingExtra = {
  amount: number;
  note: string;
};

export function EditSubscriptionRow({
  sub,
  pricing,
  extras,
  customerAddresses = [],
  skips = [],
  payments = [],
}: {
  sub: Sub;
  pricing: PricingEntry[];
  extras: Extra[];
  customerAddresses?: CustomerAddress[];
  skips?: MealSkip[];
  payments?: Payment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [plan, setPlan] = useState(sub.plan);
  const [goal, setGoal] = useState(sub.goal);
  const [mealsPerDay, setMealsPerDay] = useState(String(sub.mealsPerDay));
  const [subscriptionPrice, setSubscriptionPrice] = useState(sub.subscriptionPrice);
  const [shippingPrice, setShippingPrice] = useState(sub.shippingPrice);
  const [discount, setDiscount] = useState(sub.discount ?? 0);
  const [trialDays, setTrialDays] = useState(sub.trialDays ?? 3);
  const [startDateStr, setStartDateStr] = useState(
    new Date(sub.startDate).toISOString().split("T")[0]
  );
  const [endDateStr, setEndDateStr] = useState(
    new Date(sub.endDate).toISOString().split("T")[0]
  );
  const [addressId, setAddressId] = useState<string>(sub.addressId ?? "none");
  const [pendingExtras, setPendingExtras] = useState<PendingExtra[]>([]);
  const [deletingExtraId, setDeletingExtraId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Custom schedule state
  const [useCustomSchedule, setUseCustomSchedule] = useState(!!sub.weeklyScheduleJson);
  const [schedule, setSchedule] = useState<WeeklyMealSchedule>(() =>
    parseWeeklySchedule(sub.weeklyScheduleJson ?? null, sub.mealsPerDay)
  );

  useEffect(() => {
    if (plan === "trial") return;
    const match = pricing.find(
      (p) => p.plan === plan && p.goal === goal && p.mealsPerDay === parseInt(mealsPerDay, 10)
    );
    if (match) setSubscriptionPrice(match.totalPrice);
  }, [plan, goal, mealsPerDay, pricing]);

  useEffect(() => {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return;
    const duration = plan === "monthly" ? 19 : plan === "weekly" ? 4 : (trialDays ?? 3) - 1;
    setEndDateStr(addWorkingDays(start, duration).toISOString().split("T")[0]);
  }, [plan, startDateStr, trialDays]);

  useEffect(() => {
    if (open) {
      setPlan(sub.plan);
      setGoal(sub.goal);
      setMealsPerDay(String(sub.mealsPerDay));
      setSubscriptionPrice(sub.subscriptionPrice);
      setShippingPrice(sub.shippingPrice);
      setDiscount(sub.discount ?? 0);
      setTrialDays(sub.trialDays ?? 3);
      setStartDateStr(new Date(sub.startDate).toISOString().split("T")[0]);
      setEndDateStr(new Date(sub.endDate).toISOString().split("T")[0]);
      setAddressId(sub.addressId ?? "none");
      setPendingExtras([]);
      setShowCancel(false);
      setUseCustomSchedule(!!sub.weeklyScheduleJson);
      setSchedule(parseWeeklySchedule(sub.weeklyScheduleJson ?? null, sub.mealsPerDay));
    }
  }, [open, sub]);

  function handleDeleteExtra(id: string) {
    setDeletingExtraId(id);
    startTransition(async () => {
      await deleteExtraAction(id);
      setDeletingExtraId(null);
      router.refresh();
    });
  }

  function handleSave() {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
    const mpd = parseInt(mealsPerDay, 10);
    const scheduleError = useCustomSchedule && plan !== "trial"
      ? validateWeeklySchedule(schedule, plan, mpd)
      : null;
    if (scheduleError) return;
    startTransition(async () => {
      await updateSubscriptionAction(sub.id, {
        plan,
        goal,
        mealsPerDay: mpd,
        weeklyScheduleJson: useCustomSchedule && plan !== "trial"
          ? serializeWeeklySchedule(schedule)
          : null,
        subscriptionPrice,
        shippingPrice,
        discount,
        trialDays: plan === "trial" ? trialDays : null,
        startDate,
        endDate,
        endDateNoSkip: new Date(sub.endDateNoSkip || sub.endDate),
        addressId: addressId === "none" ? null : addressId,
      });
      for (const extra of pendingExtras) {
        if (extra.amount !== 0) {
          const fd = new FormData();
          fd.set("subscriptionId", sub.id);
          fd.set("amount", String(extra.amount));
          fd.set("note", extra.note);
          await createExtraAction(fd);
        }
      }
      setOpen(false);
      router.refresh();
    });
  }

  const extrasTotal = extras.reduce((s, e) => s + e.amount, 0)
    + pendingExtras.reduce((s, e) => s + e.amount, 0);
  const grandTotal = subscriptionPrice + shippingPrice + extrasTotal;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Pencil size={13} />
          </Button>
        }
      />
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          <div className="space-y-1">
            <Label>Meals/day</Label>
            <Select value={mealsPerDay} onValueChange={(v) => {
              if (v) {
                setMealsPerDay(v);
                setSchedule(defaultWeeklySchedule(parseInt(v, 10)));
              }
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 meal/day</SelectItem>
                <SelectItem value="2">2 meals/day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom weekly schedule */}
        {plan !== "trial" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="custom-schedule"
                type="checkbox"
                className="h-3.5 w-3.5 rounded"
                checked={useCustomSchedule}
                onChange={(e) => {
                  setUseCustomSchedule(e.target.checked);
                  if (e.target.checked) setSchedule(defaultWeeklySchedule(parseInt(mealsPerDay, 10)));
                }}
              />
              <Label htmlFor="custom-schedule" className="text-sm cursor-pointer">Custom schedule</Label>
            </div>
            {useCustomSchedule && (() => {
              const mpd = parseInt(mealsPerDay, 10);
              const total = weeklyScheduleTotal(schedule);
              const err = validateWeeklySchedule(schedule, plan, mpd);
              return (
                <div className="space-y-1">
                  <div className="grid grid-cols-5 gap-1">
                    {DAY_LABELS.map(([day, label]) => (
                      <div key={day} className="flex flex-col items-center gap-0.5">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <Input
                          type="number"
                          min={0}
                          className="text-center text-xs px-1"
                          value={schedule[day]}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              [day]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <p className={`text-xs ${err ? "text-destructive" : "text-muted-foreground"}`}>
                    {err ?? `Total: ${total} / ${mpd * 5} meals/week`}
                  </p>
                </div>
              );
            })()}
          </div>
        )}

          <div className="space-y-1">
            <Label>Goal</Label>
            <Select value={goal} onValueChange={(v) => v && setGoal(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cutting">Cutting</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="bulking">Bulking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {plan === "trial" && (
            <div className="space-y-1">
              <Label>Trial days</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
          )}

          {customerAddresses.length > 0 && (
            <div className="space-y-1">
              <Label>Delivery Address</Label>
              <Select value={addressId} onValueChange={(v) => v && setAddressId(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Customer default</SelectItem>
                  {customerAddresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}{a.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Subscription (₫)</Label>
              <FormattedAmountInput
                value={subscriptionPrice}
                onChange={(raw) => setSubscriptionPrice(Number(raw) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label>Shipping (₫)</Label>
              <FormattedAmountInput
                value={shippingPrice}
                onChange={(raw) => setShippingPrice(Number(raw) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Extras</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => setPendingExtras((prev) => [...prev, { amount: 0, note: "" }])}
              >
                <Plus size={12} /> Add extra
              </Button>
            </div>

            {extras.length === 0 && pendingExtras.length === 0 && (
              <p className="text-xs text-muted-foreground">No extras</p>
            )}

            {extras.map((extra) => (
              <div key={extra.id} className="flex items-center gap-2">
                <Input
                  type="text"
                  className="flex-1 text-xs"
                  placeholder="Note"
                  defaultValue={extra.note ?? ""}
                  readOnly
                />
                <span className="text-xs font-medium w-24 text-right shrink-0">
                  {extra.amount.toLocaleString()} VND
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  disabled={deletingExtraId === extra.id || pending}
                  onClick={() => handleDeleteExtra(extra.id)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}

            {pendingExtras.map((extra, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="text"
                  className="flex-1 text-xs"
                  placeholder="Note"
                  value={extra.note}
                  onChange={(e) =>
                    setPendingExtras((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x))
                    )
                  }
                />
                <FormattedAmountInput
                  className="w-28 text-xs"
                  placeholder="Amount (₫)"
                  value={extra.amount}
                  onChange={(raw) =>
                    setPendingExtras((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, amount: Number(raw) || 0 } : x))
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setPendingExtras((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-muted/60 p-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subscription</span>
              <span>{subscriptionPrice.toLocaleString()} VND</span>
            </div>
            {shippingPrice > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{shippingPrice.toLocaleString()} VND</span>
              </div>
            )}
            {extrasTotal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Extras</span>
                <span>{extrasTotal.toLocaleString()} VND</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total</span>
              <span>{grandTotal.toLocaleString()} VND</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={pending || subscriptionPrice <= 0}
              onClick={handleSave}
            >
              {pending ? "Saving…" : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
          </div>

          {/* Cancel subscription section */}
          {sub.status !== "cancelled" && !showCancel && (
            <div className="border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setShowCancel(true)}
                disabled={pending}
              >
                Cancel Subscription
              </Button>
            </div>
          )}
          {sub.status !== "cancelled" && showCancel && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-destructive">Cancel Subscription</p>
              <CancelSubscriptionForm
                sub={sub}
                customerId={sub.customerId}
                skips={skips}
                payments={payments}
                extras={extras}
                onDone={() => { setOpen(false); router.refresh(); }}
                onCancel={() => setShowCancel(false)}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
