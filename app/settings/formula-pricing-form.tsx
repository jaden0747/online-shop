"use client";

import { useState, useTransition } from "react";
import { updateFormulaSettingsAction } from "@/app/actions/settings";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";

const GOALS = ["cutting", "maintenance", "bulking", "keto"] as const;
const PLANS = [
  { label: "Trial (3 days)", days: 3 },
  { label: "Weekly (5 days)", days: 5 },
  { label: "Monthly (20 days)", days: 20 },
];

export function FormulaPricingForm({
  basePrice,
  multipliers,
}: {
  basePrice: number;
  multipliers: Record<string, number>;
}) {
  const [base, setBase] = useState(String(basePrice || ""));
  const [muls, setMuls] = useState<Record<string, string>>(
    Object.fromEntries(GOALS.map((g) => [g, String(multipliers[g] ?? 1)]))
  );
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  const baseNum = parseFloat(base) || 0;
  const computedPrices = GOALS.map((g) => ({
    goal: g,
    pricePerMeal: Math.round(baseNum * (parseFloat(muls[g]) || 1)),
  }));

  function handleSave() {
    startSave(async () => {
      await updateFormulaSettingsAction({
        basePricePerMeal: parseFloat(base) || 0,
        goalMultiplierCutting: parseFloat(muls.cutting) || 1,
        goalMultiplierMaintenance: parseFloat(muls.maintenance) || 1,
        goalMultiplierBulking: parseFloat(muls.bulking) || 1,
        goalMultiplierKeto: parseFloat(muls.keto) || 1,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const inp = "border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium w-36">Base price/meal</label>
        <FormattedAmountInput
          className="w-32"
          placeholder="e.g. 45,000"
          value={base}
          onChange={(raw) => setBase(raw)}
        />
        <span className="text-xs text-muted-foreground">VND</span>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Goal multipliers</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {GOALS.map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm">
              <span className="capitalize w-24">{g}</span>
              <input
                className={`${inp} w-20`}
                type="number"
                step="0.01"
                min="0"
                value={muls[g]}
                onChange={(e) => setMuls((p) => ({ ...p, [g]: e.target.value }))}
              />
              {baseNum > 0 && (
                <span className="text-xs text-muted-foreground">
                  → {Math.round(baseNum * (parseFloat(muls[g]) || 1)).toLocaleString()} VND/meal
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {baseNum > 0 && (
        <div className="overflow-x-auto">
          <p className="text-sm font-medium mb-1">Price preview (subscription price excl. shipping)</p>
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left pr-4 py-1 text-muted-foreground font-normal">Plan</th>
                {GOALS.map((g) => (
                  <th key={g} className="px-3 py-1 text-muted-foreground font-normal capitalize">{g}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANS.map((plan) => (
                [1, 2].map((mpd) => (
                  <tr key={`${plan.label}-${mpd}`} className="border-t border-muted">
                    <td className="pr-4 py-1 text-muted-foreground">{plan.label} · {mpd}×/day</td>
                    {computedPrices.map(({ goal, pricePerMeal }) => (
                      <td key={goal} className="px-3 py-1 text-right font-medium">
                        {(pricePerMeal * plan.days * mpd).toLocaleString()} VND
                      </td>
                    ))}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {saved ? "Saved ✓" : "Save formula"}
      </button>
    </div>
  );
}
