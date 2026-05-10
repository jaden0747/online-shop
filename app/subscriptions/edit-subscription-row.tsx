"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSubscriptionAction, createExtraAction, deleteExtraAction } from "../actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pencil, Trash2, Plus } from "lucide-react";

type Sub = {
  id: string;
  plan: string;
  goal: string;
  mealsPerDay: number;
  subscriptionPrice: number;
  shippingPrice: number;
  discount: number;
  trialDays: number | null;
  startDate: string;
  endDate: string;
  endDateNoSkip: string;
};

type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };

type Extra = {
  id: string;
  subscriptionId: string;
  amount: number;
  note: string | null;
};

type PendingExtra = {
  amount: number;
  note: string;
};

export function EditSubscriptionRow({
  sub,
  pricing,
  extras,
}: {
  sub: Sub;
  pricing: PricingEntry[];
  extras: Extra[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
  const [pendingExtras, setPendingExtras] = useState<PendingExtra[]>([]);
  const [deletingExtraId, setDeletingExtraId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      setPendingExtras([]);
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
    startTransition(async () => {
      await updateSubscriptionAction(sub.id, {
        plan,
        goal,
        mealsPerDay: mpd,
        subscriptionPrice,
        shippingPrice,
        discount,
        trialDays: plan === "trial" ? trialDays : null,
        startDate,
        endDate,
        endDateNoSkip: new Date(sub.endDateNoSkip || sub.endDate),
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
      <DialogTrigger render={<Button size="icon" variant="ghost" className="h-7 w-7" />}>
        <Pencil size={13} />
      </DialogTrigger>
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
              <Select value={mealsPerDay} onValueChange={(v) => v && setMealsPerDay(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 meal/day</SelectItem>
                  <SelectItem value="2">2 meals/day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
              <Input
                type="number"
                step="1000"
                value={subscriptionPrice || ""}
                onChange={(e) => setSubscriptionPrice(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Shipping (₫)</Label>
              <Input
                type="number"
                step="1000"
                value={shippingPrice || ""}
                onChange={(e) => setShippingPrice(Number(e.target.value))}
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
                  ₫{extra.amount.toLocaleString()}
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
                <Input
                  type="number"
                  step="1000"
                  className="w-28 text-xs"
                  placeholder="Amount (₫)"
                  value={extra.amount || ""}
                  onChange={(e) =>
                    setPendingExtras((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value) } : x))
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
              <span>₫{subscriptionPrice.toLocaleString()}</span>
            </div>
            {shippingPrice > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>₫{shippingPrice.toLocaleString()}</span>
              </div>
            )}
            {extrasTotal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Extras</span>
                <span>₫{extrasTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total</span>
              <span>₫{grandTotal.toLocaleString()}</span>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
