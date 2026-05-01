"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSubscriptionAction } from "../actions/subscriptions";
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
  startDate: string;
  renewalDate: string;
};

type PricingEntry = { goal: string; plan: string; mealsPerDay: number; totalPrice: number };

export function EditSubscriptionRow({
  sub,
  pricing,
}: {
  sub: Sub;
  pricing: PricingEntry[];
}) {
  const router = useRouter();
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

  useEffect(() => {
    const match = pricing.find(
      (p) => p.plan === plan && p.goal === goal && p.mealsPerDay === parseInt(mealsPerDay, 10)
    );
    if (match) setPackagePrice(match.totalPrice);
  }, [plan, goal, mealsPerDay, pricing]);

  useEffect(() => {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return;
    const duration = plan === "monthly" ? 20 : plan === "weekly" ? 5 : 3;
    setRenewalDateStr(addWorkingDays(start, duration).toISOString().split("T")[0]);
  }, [plan, startDateStr]);

  // Reset to sub values when dialog opens
  useEffect(() => {
    if (open) {
      setPlan(sub.plan);
      setGoal(sub.goal);
      setMealsPerDay(String(sub.mealsPerDay));
      setPackagePrice(sub.packagePrice);
      setStartDateStr(new Date(sub.startDate).toISOString().split("T")[0]);
      setRenewalDateStr(new Date(sub.renewalDate).toISOString().split("T")[0]);
    }
  }, [open, sub]);

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
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="icon" variant="ghost" className="h-7 w-7" />}>
        <Pencil size={13} />
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial (3 days)</SelectItem>
                  <SelectItem value="weekly">Weekly (5 days)</SelectItem>
                  <SelectItem value="monthly">Monthly (20 days)</SelectItem>
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
                value={renewalDateStr}
                onChange={(e) => setRenewalDateStr(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Package price (₫)</Label>
            <Input
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
