"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSubscriptionAction } from "../actions/subscriptions";
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
import { planTotalMeals } from "@/lib/utils/subscription";

type Customer = { id: string; name: string; phone: string };
type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };

export function NewSubscriptionDialog({
  customers,
  pricing,
}: {
  customers: Customer[];
  pricing: PricingEntry[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [plan, setPlan] = useState("weekly");
  const [goal, setGoal] = useState("maintenance");
  const [mealsPerDay, setMealsPerDay] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);
  const [shippingPrice, setShippingPrice] = useState(0);
  const [trialDays, setTrialDays] = useState(3);
  const [search, setSearch] = useState("");

  const filteredCustomers = search.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search)
      )
    : customers;

  const selectedCustomer = customers.find((c) => c.id === customerId);

  useEffect(() => {
    if (plan === "trial") return;
    const match = pricing.find(
      (p) => p.plan === plan && p.goal === goal && p.mealsPerDay === parseInt(mealsPerDay, 10)
    );
    if (match) setSubscriptionPrice(match.totalPrice);
    else setSubscriptionPrice(0);
  }, [plan, goal, mealsPerDay, pricing]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setCustomerId(customers[0]?.id ?? "");
      setPlan("weekly");
      setGoal("maintenance");
      setMealsPerDay("1");
      setStartDate(new Date().toISOString().split("T")[0]);
      setShippingPrice(0);
      setTrialDays(3);
    }
  }, [open, customers]);

  const [, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set("customerId", customerId);
      formData.set("plan", plan);
      formData.set("goal", goal);
      formData.set("mealsPerDay", mealsPerDay);
      formData.set("subscriptionPrice", String(subscriptionPrice));
      formData.set("shippingPrice", String(shippingPrice));
      if (plan === "trial") formData.set("trialDays", String(trialDays));
      formData.set("startDate", startDate);
      await createSubscriptionAction(formData);
      setOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  const mpd = parseInt(mealsPerDay, 10);
  const totalMeals = planTotalMeals(plan) * mpd;
  const total = subscriptionPrice + shippingPrice;
  const pricePerMealCalc = totalMeals > 0 && subscriptionPrice > 0 ? subscriptionPrice / totalMeals : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>+ New Subscription</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Subscription</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-5">

          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Input
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="border rounded-md overflow-y-auto max-h-44">
              {filteredCustomers.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">No customers found</p>
              ) : (
                filteredCustomers.map((c) => {
                  const selected = c.id === customerId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCustomerId(c.id)}
                      className={[
                        "w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent",
                      ].join(" ")}
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className={selected ? "opacity-80 text-xs" : "text-xs text-muted-foreground"}>
                        {c.phone}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {selectedCustomer && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedCustomer.name}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newSubStartDate">Start Date</Label>
            <Input
              id="newSubStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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

          <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="newTrialDays">Trial days</Label>
              <Input
                id="newTrialDays"
                type="number"
                min={1}
                max={10}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="newSubPrice">Subscription (₫)</Label>
              <Input
                id="newSubPrice"
                type="number"
                step="1000"
                value={subscriptionPrice || ""}
                onChange={(e) => setSubscriptionPrice(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newShipPrice">Shipping (₫)</Label>
              <Input
                id="newShipPrice"
                type="number"
                step="1000"
                value={shippingPrice || ""}
                onChange={(e) => setShippingPrice(Number(e.target.value))}
              />
            </div>
          </div>

          {(subscriptionPrice > 0 || shippingPrice > 0) && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm space-y-1">
              {subscriptionPrice > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Subscription</span>
                  <span>₫{subscriptionPrice.toLocaleString()}</span>
                </div>
              )}
              {pricePerMealCalc > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Price/meal ({totalMeals} meals)</span>
                  <span>₫{Math.round(pricePerMealCalc).toLocaleString()}</span>
                </div>
              )}
              {shippingPrice > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>₫{shippingPrice.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total</span>
                <span>₫{total.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || !customerId || subscriptionPrice <= 0}
          >
            {pending ? "Saving…" : "Create Subscription"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
