"use client";

import { useState, useEffect, useTransition } from "react";
import { updateSubscriptionAction } from "../../actions/subscriptions";
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
import { addWorkingDays, planTotalMeals } from "@/lib/utils/subscription";
import { Pencil } from "lucide-react";

type Sub = {
  id: string;
  plan: string;
  goal: string;
  mealsPerDay: number;
  packagePrice: number;
  startDate: Date | string;
  renewalDate: Date | string;
};

type PricingEntry = {
  goal: string;
  plan: string;
  mealsPerDay: number;
  totalPrice: number;
};

export function EditSubscriptionForm({
  sub,
  pricing,
}: {
  sub: Sub;
  pricing: PricingEntry[];
}) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(sub.plan);
  const [goal, setGoal] = useState(sub.goal);
  const [mealsPerDay, setMealsPerDay] = useState(String(sub.mealsPerDay));
  const [packagePrice, setPackagePrice] = useState(sub.packagePrice);
  const [startDateStr, setStartDateStr] = useState(
    new Date(sub.startDate).toISOString().split("T")[0]
  );
  const [renewalDateStr, setRenewalDateStr] = useState(
    new Date(sub.renewalDate).toISOString().split("T")[0]
  );
  const [pending, startTransition] = useTransition();

  // Auto-fill price from pricing config when selection changes
  useEffect(() => {
    const match = pricing.find(
      (p) =>
        p.plan === plan &&
        p.goal === goal &&
        p.mealsPerDay === parseInt(mealsPerDay, 10)
    );
    if (match) setPackagePrice(match.totalPrice);
  }, [plan, goal, mealsPerDay, pricing]);

  // Recompute renewal date when plan or start date changes
  useEffect(() => {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return;
    const duration = plan === "monthly" ? 20 : plan === "weekly" ? 5 : 3;
    const computed = addWorkingDays(start, duration);
    setRenewalDateStr(computed.toISOString().split("T")[0]);
  }, [plan, startDateStr]);

  function handleSave() {
    const startDate = new Date(startDateStr);
    const renewalDate = new Date(renewalDateStr);
    if (isNaN(startDate.getTime()) || isNaN(renewalDate.getTime())) return;
    const mpd = parseInt(mealsPerDay, 10);
    const totalMeals = planTotalMeals(plan) * mpd;
    const pricePerMeal = totalMeals > 0 ? packagePrice / totalMeals : 0;
    startTransition(async () => {
      await updateSubscriptionAction(sub.id, {
        plan,
        goal,
        mealsPerDay: mpd,
        packagePrice,
        pricePerMeal,
        startDate,
        renewalDate,
      });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <Pencil size={13} className="mr-1" />
        Edit
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (3 days)</SelectItem>
                  <SelectItem value="weekly">Weekly (5 meals)</SelectItem>
                  <SelectItem value="monthly">Monthly (20 meals)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Meals per day</Label>
              <Select
                value={mealsPerDay}
                onValueChange={(v) => v && setMealsPerDay(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cutting">Cutting</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="bulking">Bulking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="subStartDate">Start Date</Label>
              <Input
                id="subStartDate"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="subRenewalDate">End Date</Label>
              <Input
                id="subRenewalDate"
                type="date"
                value={renewalDateStr}
                onChange={(e) => setRenewalDateStr(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="editPackagePrice">Package price (₫)</Label>
            <Input
              id="editPackagePrice"
              type="number"
              step="1000"
              value={packagePrice || ""}
              onChange={(e) => setPackagePrice(Number(e.target.value))}
            />
          </div>

          <Button
            className="w-full"
            disabled={pending || packagePrice <= 0}
            onClick={handleSave}
          >
            {pending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
