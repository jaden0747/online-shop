"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { upsertPricingAction } from "../actions/pricing";
import { Button } from "@/components/ui/button";
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
import { planTotalMeals } from "@/lib/utils/subscription";

type Existing = {
  plan: string;
  goal: string;
  mealsPerDay: number;
  totalPrice: number;
};

export function UpsertPricingForm({
  existing,
  label,
}: {
  existing?: Existing;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [plan, setPlan] = useState(existing?.plan ?? "weekly");
  const [goal, setGoal] = useState(existing?.goal ?? "maintenance");
  const [mealsPerDay, setMealsPerDay] = useState(String(existing?.mealsPerDay ?? 1));
  const [totalPrice, setTotalPrice] = useState(existing?.totalPrice ?? 0);

  const [, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      formData.set("plan", plan);
      formData.set("goal", goal);
      formData.set("mealsPerDay", mealsPerDay);
      formData.set("totalPrice", String(totalPrice));
      await upsertPricingAction(formData);
      setOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  const totalMeals = planTotalMeals(plan) * parseInt(mealsPerDay, 10);
  const pricePerMeal = totalMeals > 0 && totalPrice > 0 ? totalPrice / totalMeals : 0;
  const isEdit = !!existing;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant={isEdit ? "ghost" : "outline"} />}>
        {label ?? (isEdit ? "Edit" : "+ Add pricing")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Pricing" : "Add Pricing"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select
                value={plan}
                onValueChange={(v) => v && setPlan(v)}
                disabled={isEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Meals per day</Label>
              <Select
                value={mealsPerDay}
                onValueChange={(v) => v && setMealsPerDay(v)}
                disabled={isEdit}
              >
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
            <Select
              value={goal}
              onValueChange={(v) => v && setGoal(v)}
              disabled={isEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cutting">Cutting</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="bulking">Bulking</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="totalPrice">Package price (₫)</Label>
            <FormattedAmountInput
              id="totalPrice"
              value={totalPrice}
              onChange={(raw) => setTotalPrice(Number(raw) || 0)}
            />
            {pricePerMeal > 0 && (
              <p className="text-xs text-muted-foreground">
                ₫{Math.round(pricePerMeal).toLocaleString()}/meal · {totalMeals} meals total
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pending || totalPrice <= 0}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
