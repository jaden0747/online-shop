"use client";

import { useState } from "react";
import { updateShippingFeeAction } from "@/app/actions/settings";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ShippingFeeFormProps {
  zone1MaxKm: number;
  zone1: number;
  zone2MaxKm: number;
  zone2: number;
  zone3MaxKm: number;
  zone3: number;
  zone4PerKm: number;
}

export function ShippingFeeForm(props: ShippingFeeFormProps) {
  const [values, setValues] = useState({ ...props });
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    await updateShippingFeeAction(fd);
    setIsPending(false);
    setSaved(true);
  }

  const setNum = (key: keyof typeof values) => (val: number) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="zone1MaxKm">Zone 1 max (km)</Label>
          <Input
            id="zone1MaxKm"
            name="zone1MaxKm"
            type="number"
            min={0}
            step="0.1"
            value={values.zone1MaxKm}
            onChange={(e) => setNum("zone1MaxKm")(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone1">Zone 1 fee (₫)</Label>
          <FormattedAmountInput
            value={values.zone1}
            onChange={(v) => setNum("zone1")(Number(v) || 0)}
            placeholder="15,000"
          />
          <input type="hidden" name="zone1" value={values.zone1} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="zone2MaxKm">Zone 2 max (km)</Label>
          <Input
            id="zone2MaxKm"
            name="zone2MaxKm"
            type="number"
            min={0}
            step="0.1"
            value={values.zone2MaxKm}
            onChange={(e) => setNum("zone2MaxKm")(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone2">Zone 2 fee (₫)</Label>
          <FormattedAmountInput
            value={values.zone2}
            onChange={(v) => setNum("zone2")(Number(v) || 0)}
            placeholder="25,000"
          />
          <input type="hidden" name="zone2" value={values.zone2} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="zone3MaxKm">Zone 3 max (km)</Label>
          <Input
            id="zone3MaxKm"
            name="zone3MaxKm"
            type="number"
            min={0}
            step="0.1"
            value={values.zone3MaxKm}
            onChange={(e) => setNum("zone3MaxKm")(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone3">Zone 3 fee (₫)</Label>
          <FormattedAmountInput
            value={values.zone3}
            onChange={(v) => setNum("zone3")(Number(v) || 0)}
            placeholder="35,000"
          />
          <input type="hidden" name="zone3" value={values.zone3} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="zone4PerKm">Zone 4 rate (₫/km, beyond zone 3)</Label>
          <FormattedAmountInput
            value={values.zone4PerKm}
            onChange={(v) => setNum("zone4PerKm")(Number(v) || 0)}
            placeholder="5,000"
          />
          <input type="hidden" name="zone4PerKm" value={values.zone4PerKm} />
        </div>
      </div>

      <div className="rounded-md border text-sm divide-y">
        <div className="px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">Preview</div>
        {[
          { label: `0 – ${values.zone1MaxKm} km`, fee: values.zone1 },
          { label: `${values.zone1MaxKm} – ${values.zone2MaxKm} km`, fee: values.zone2 },
          { label: `${values.zone2MaxKm} – ${values.zone3MaxKm} km`, fee: values.zone3 },
          { label: `> ${values.zone3MaxKm} km`, fee: null, perKm: values.zone4PerKm },
        ].map(({ label, fee, perKm }) => (
          <div key={label} className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">
              {fee != null ? `${fee.toLocaleString()} ₫` : `${(perKm ?? 0).toLocaleString()} ₫/km`}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </form>
  );
}
