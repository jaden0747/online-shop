"use client";

import { useState, useTransition, useEffect } from "react";
import { convertLeadAction } from "@/app/actions/assistant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";

type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };

interface Props {
  lead: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
    goal: string | null;
    mealsPerDay: number | null;
    note: string | null;
  };
  pricing: PricingEntry[];
}

const GOALS = ["cutting", "maintenance", "bulking", "keto"] as const;
const PLANS = ["weekly", "monthly", "trial"] as const;

export function ConvertLeadDialog({ lead, pricing }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Customer fields
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [address, setAddress] = useState(lead.address ?? "");
  const [addressLabel, setAddressLabel] = useState("Nhà");
  const [zone, setZone] = useState("");
  const [notes, setNotes] = useState(lead.note ?? "");

  // Subscription toggle
  const [createSub, setCreateSub] = useState(false);
  const [plan, setPlan] = useState<string>("weekly");
  const [goal, setGoal] = useState<string>(lead.goal ?? "maintenance");
  const [mealsPerDay, setMealsPerDay] = useState<string>(String(lead.mealsPerDay ?? 1));
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [trialDays, setTrialDays] = useState(3);
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);
  const [shippingPrice, setShippingPrice] = useState(0);

  // Auto-fill price from pricing table when plan/goal/meals change
  useEffect(() => {
    if (!createSub || plan === "trial") return;
    const match = pricing.find(
      (p) => p.plan === plan && p.goal === goal && p.mealsPerDay === parseInt(mealsPerDay, 10)
    );
    if (match) setSubscriptionPrice(match.totalPrice);
  }, [plan, goal, mealsPerDay, createSub, pricing]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(lead.name);
      setPhone(lead.phone);
      setAddress(lead.address ?? "");
      setAddressLabel("Nhà");
      setZone("");
      setNotes(lead.note ?? "");
      setCreateSub(false);
      setPlan("weekly");
      setGoal(lead.goal ?? "maintenance");
      setMealsPerDay(String(lead.mealsPerDay ?? 1));
      setStartDate(new Date().toISOString().slice(0, 10));
      setTrialDays(3);
      setSubscriptionPrice(0);
      setShippingPrice(0);
      setError(null);
    }
  }, [open, lead]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("leadId", lead.id);
    fd.set("name", name);
    fd.set("phone", phone);
    fd.set("address", address);
    fd.set("addressLabel", addressLabel);
    fd.set("zone", zone);
    fd.set("notes", notes);
    if (createSub) {
      fd.set("createSubscription", "1");
      fd.set("plan", plan);
      fd.set("goal", goal);
      fd.set("mealsPerDay", mealsPerDay);
      fd.set("startDate", startDate);
      fd.set("subscriptionPrice", String(subscriptionPrice));
      fd.set("shippingPrice", String(shippingPrice));
      if (plan === "trial") fd.set("trialDays", String(trialDays));
    }
    startTransition(async () => {
      const result = await convertLeadAction(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  const totalPrice = subscriptionPrice + shippingPrice;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
      >
        Convert
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert lead to customer</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Customer info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cl-name" className="text-xs">Name</Label>
                  <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cl-phone" className="text-xs">Phone</Label>
                  <Input id="cl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required className="font-mono" />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cl-address" className="text-xs">Address</Label>
                <Input id="cl-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full delivery address" />
              </div>

              {address && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="cl-addr-label" className="text-xs">Address label</Label>
                    <Input id="cl-addr-label" value={addressLabel} onChange={(e) => setAddressLabel(e.target.value)} placeholder="e.g. Nhà, Công ty" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cl-zone" className="text-xs">Zone</Label>
                    <Input id="cl-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. Q1, Bình Thạnh" />
                  </div>
                </div>
              )}

              {!address && (
                <div className="space-y-1">
                  <Label htmlFor="cl-zone" className="text-xs">Zone</Label>
                  <Input id="cl-zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. Q1, Bình Thạnh" />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="cl-notes" className="text-xs">Notes</Label>
                <Input id="cl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal note" />
              </div>
            </div>

            {/* Subscription toggle */}
            <div className="border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createSub}
                  onChange={(e) => setCreateSub(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium">Create subscription now</span>
              </label>
            </div>

            {createSub && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Plan</Label>
                    <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Goal</Label>
                    <Select value={goal} onValueChange={(v) => v && setGoal(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GOALS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Meals/day</Label>
                    <Select value={mealsPerDay} onValueChange={(v) => v && setMealsPerDay(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="cl-start" className="text-xs">Start date</Label>
                    <Input id="cl-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  {plan === "trial" && (
                    <div className="space-y-1">
                      <Label htmlFor="cl-trial-days" className="text-xs">Trial days</Label>
                      <Input
                        id="cl-trial-days"
                        type="number"
                        min={1}
                        max={10}
                        value={trialDays}
                        onChange={(e) => setTrialDays(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Subscription (₫)</Label>
                    <FormattedAmountInput
                      value={subscriptionPrice}
                      onChange={(v) => setSubscriptionPrice(Number(v) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shipping (₫)</Label>
                    <FormattedAmountInput
                      value={shippingPrice}
                      onChange={(v) => setShippingPrice(Number(v) || 0)}
                      className="h-8"
                    />
                  </div>
                </div>

                {totalPrice > 0 && (
                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{totalPrice.toLocaleString()} ₫</span>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter showCloseButton>
              <Button type="submit" disabled={pending} size="sm">
                {pending ? "Creating…" : createSub ? "Create customer & subscription" : "Create customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
