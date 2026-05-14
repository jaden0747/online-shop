"use client";

import { useActionState, useState } from "react";
import { updateMealPriceAction } from "@/app/actions/settings";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const GOALS = ["cutting", "maintenance", "bulking", "keto"] as const;

interface MealPriceFormProps {
  mealPrices: Record<string, number>;
}

export function MealPriceForm({ mealPrices }: MealPriceFormProps) {
  const [values, setValues] = useState<Record<string, number>>({ ...mealPrices });
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    await updateMealPriceAction(fd);
    setIsPending(false);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map((goal) => {
            const fieldName = `mealPrice${goal.charAt(0).toUpperCase() + goal.slice(1)}`;
            return (
              <div key={goal} className="space-y-1.5">
                <Label htmlFor={fieldName} className="capitalize">{goal} (₫/meal)</Label>
                <FormattedAmountInput
                  value={values[goal] ?? mealPrices[goal]}
                  onChange={(raw) => setValues((prev) => ({ ...prev, [goal]: Number(raw) || 0 }))}
                  placeholder="50,000"
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </form>

      {/* Preview table */}
      {GOALS.some((g) => (values[g] ?? mealPrices[g]) > 0) && (
        <div className="rounded-lg border text-sm">
          <div className="px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
            Trial price preview (meal price × days × meals/day)
          </div>
          <div className="divide-y">
            {GOALS.filter((g) => (values[g] ?? mealPrices[g]) > 0).map((goal) => {
              const mp = values[goal] ?? mealPrices[goal];
              return (
                <div key={goal} className="flex items-center justify-between px-3 py-2">
                  <Badge variant="outline" className="capitalize w-28 justify-center">{goal}</Badge>
                  <div className="flex gap-6 text-muted-foreground text-xs">
                    {[3, 5, 7].map((days) => (
                      <div key={days} className="text-right">
                        <p className="font-medium text-foreground">₫{(mp * days * 1).toLocaleString()}</p>
                        <p>{days}d × 1/day</p>
                      </div>
                    ))}
                    {[3, 5, 7].map((days) => (
                      <div key={`${days}-2`} className="text-right">
                        <p className="font-medium text-foreground">₫{(mp * days * 2).toLocaleString()}</p>
                        <p>{days}d × 2/day</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
