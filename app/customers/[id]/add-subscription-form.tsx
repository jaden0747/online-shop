"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSubscriptionAction } from "../../actions/subscriptions";
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

type PricingEntry = {
  goal: string;
  plan: string;
  mealsPerDay: number;
  totalPrice: number;
};

export function AddSubscriptionForm({
  customerId,
  pricing,
}: {
  customerId: string;
  pricing: PricingEntry[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [plan, setPlan] = useState("weekly");
  const [goal, setGoal] = useState("maintenance");
  const [mealsPerDay, setMealsPerDay] = useState("1");
  const [packagePrice, setPackagePrice] = useState(0);

  // Auto-fill from pricing config when selection changes
  useEffect(() => {
    const match = pricing.find(
      (p) =>
        p.plan === plan &&
        p.goal === goal &&
        p.mealsPerDay === parseInt(mealsPerDay, 10)
    );
    if (match) setPackagePrice(match.totalPrice);
    else setPackagePrice(0);
  }, [plan, goal, mealsPerDay, pricing]);

  const [, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set("plan", plan);
      formData.set("goal", goal);
      formData.set("mealsPerDay", mealsPerDay);
      formData.set("packagePrice", String(packagePrice));
      await createSubscriptionAction(formData);
      setOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  const mpd = parseInt(mealsPerDay, 10);
  const totalMeals = planTotalMeals(plan) * mpd;
  const pricePerMeal = totalMeals > 0 ? packagePrice / totalMeals : 0;
  const hasPricingMatch = pricing.some(
    (p) =>
      p.plan === plan &&
      p.goal === goal &&
      p.mealsPerDay === mpd
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>+ Add Subscription</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Subscription</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="customerId" value={customerId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (3 days)</SelectItem>
                  <SelectItem value="weekly">Weekly (5 meals)</SelectItem>
                  <SelectItem value="monthly">Monthly (20 meals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Meals per day</Label>
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

          <div className="space-y-1">
            <Label htmlFor="packagePrice">Package price (₫)</Label>
            <Input
              id="packagePrice"
              name="packagePrice"
              type="number"
              step="1000"
              value={packagePrice || ""}
              onChange={(e) => setPackagePrice(Number(e.target.value))}
              required
            />
            {!hasPricingMatch && (
              <p className="text-xs text-amber-600">
                No pricing preset found — enter manually. Add one in{" "}
                <a href="/pricing" className="underline">
                  Pricing
                </a>
                .
              </p>
            )}
          </div>

          {packagePrice > 0 && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total meals</span>
                <span>{totalMeals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price per meal</span>
                <span className="font-medium">
                  ₫{Math.round(pricePerMeal).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Full payment</span>
                <span>₫{packagePrice.toLocaleString()}</span>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || packagePrice <= 0}
          >
            {pending ? "Saving…" : "Save Subscription"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
