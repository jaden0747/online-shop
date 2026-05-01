"use client";

import { useState, useTransition } from "react";
import { setOrderMealsAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Utensils } from "lucide-react";

type MenuItem = { id: string; day: number; slot: number; name: string; description: string | null };
type Address = { id: string; label: string; address: string; isDefault: boolean };

type DaySelection =
  | { type: "a2" }           // slot 1 × 2
  | { type: "b2" }           // slot 2 × 2
  | { type: "ab" }           // slot 1 + slot 2
  | { type: "a" }            // slot 1 × 1
  | { type: "b" }            // slot 2 × 1
  | { type: "custom"; notes: string };

const DAYS = [
  { num: 1, label: "Monday" },
  { num: 2, label: "Tuesday" },
  { num: 3, label: "Wednesday" },
  { num: 4, label: "Thursday" },
  { num: 5, label: "Friday" },
];

function selectionToItems(
  day: number,
  sel: DaySelection,
  slot1Id: string | null,
  slot2Id: string | null
): { day: number; mealSlot: number; menuItemId: string | null; quantity: number; notes?: string }[] {
  switch (sel.type) {
    case "a":
      return [{ day, mealSlot: 1, menuItemId: slot1Id, quantity: 1 }];
    case "b":
      return [{ day, mealSlot: 2, menuItemId: slot2Id, quantity: 1 }];
    case "a2":
      return [{ day, mealSlot: 1, menuItemId: slot1Id, quantity: 2 }];
    case "b2":
      return [{ day, mealSlot: 2, menuItemId: slot2Id, quantity: 2 }];
    case "ab":
      return [
        { day, mealSlot: 1, menuItemId: slot1Id, quantity: 1 },
        { day, mealSlot: 2, menuItemId: slot2Id, quantity: 1 },
      ];
    case "custom":
      return sel.notes.trim()
        ? [{ day, mealSlot: 1, menuItemId: null, quantity: 1, notes: sel.notes.trim() }]
        : [];
  }
}

export function MealSelector({
  orderId,
  menuItems,
  existingSelections,
  allowedDays,
  skippedDays,
  mealsPerDay,
  selectionCount,
  addresses,
  currentAddressId,
}: {
  orderId: string;
  menuItems: MenuItem[];
  existingSelections: { day: number; mealSlot: number; menuItemId: string | null; quantity: number; notes: string | null }[];
  allowedDays: number[] | null;
  skippedDays?: number[];
  mealsPerDay: number;
  selectionCount: number;
  addresses: Address[];
  currentAddressId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedAddressId, setSelectedAddressId] = useState(currentAddressId ?? "");

  const byDaySlot = new Map(menuItems.map((m) => [`${m.day}-${m.slot}`, m]));

  const activeDays = allowedDays
    ? DAYS.filter((d) => allowedDays.includes(d.num) && !(skippedDays ?? []).includes(d.num))
    : DAYS.filter((d) => !(skippedDays ?? []).includes(d.num));

  function inferSelection(day: number): DaySelection | null {
    const items = existingSelections.filter((s) => s.day === day);
    if (items.length === 0) return null;
    const custom = items.find((i) => !i.menuItemId);
    if (custom) return { type: "custom", notes: custom.notes ?? "" };
    if (items.length === 1) {
      const i = items[0];
      if (i.mealSlot === 1 && i.quantity === 2) return { type: "a2" };
      if (i.mealSlot === 2 && i.quantity === 2) return { type: "b2" };
      if (i.mealSlot === 1) return { type: "a" };
      return { type: "b" };
    }
    return { type: "ab" };
  }

  const initSelections = () => {
    const map: Record<number, DaySelection> = {};
    for (const { num } of activeDays) {
      const s = inferSelection(num);
      if (s) map[num] = s;
    }
    return map;
  };

  const [selections, setSelections] = useState<Record<number, DaySelection>>(initSelections);

  function setDay(day: number, sel: DaySelection | null) {
    setSelections((prev) => {
      const next = { ...prev };
      if (sel === null) delete next[day];
      else next[day] = sel;
      return next;
    });
  }

  function save() {
    const flat: { day: number; mealSlot: number; menuItemId: string | null; quantity: number; notes?: string }[] = [];
    for (const { num } of activeDays) {
      const sel = selections[num];
      if (!sel) continue;
      const slot1 = byDaySlot.get(`${num}-1`);
      const slot2 = byDaySlot.get(`${num}-2`);
      flat.push(...selectionToItems(num, sel, slot1?.id ?? null, slot2?.id ?? null));
    }
    startTransition(async () => {
      await setOrderMealsAction(orderId, flat, selectedAddressId || null);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setSelections(initSelections());
          setSelectedAddressId(currentAddressId ?? ""); // reset on open
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Utensils size={13} className="mr-1" />
        Meals
        {selectionCount > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">{selectionCount}</Badge>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Meals</DialogTitle>
        </DialogHeader>
        {addresses.length > 0 && (
          <div className="space-y-1">
            <Label className="text-sm">Delivery Address</Label>
            <Select value={selectedAddressId} onValueChange={(v) => setSelectedAddressId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Use primary address" />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}{a.isDefault ? " (default)" : ""} — {a.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {activeDays.map(({ num, label }) => {
            const slot1 = byDaySlot.get(`${num}-1`) ?? null;
            const slot2 = byDaySlot.get(`${num}-2`) ?? null;
            if (!slot1 && !slot2) return null;

            const sel = selections[num] ?? null;
            const isCustom = sel?.type === "custom";

            return (
              <div key={num} className="space-y-2">
                <p className="text-sm font-medium">{label}</p>

                {mealsPerDay === 2 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {slot1 && (
                      <OptionBtn
                        selected={sel?.type === "a2"}
                        onClick={() => setDay(num, sel?.type === "a2" ? null : { type: "a2" })}
                      >
                        <span className="font-medium">{slot1.name}</span>
                        <span className="text-xs text-muted-foreground"> ×2</span>
                        {slot1.description && <p className="text-xs text-muted-foreground mt-0.5">{slot1.description}</p>}
                      </OptionBtn>
                    )}
                    {slot2 && (
                      <OptionBtn
                        selected={sel?.type === "b2"}
                        onClick={() => setDay(num, sel?.type === "b2" ? null : { type: "b2" })}
                      >
                        <span className="font-medium">{slot2.name}</span>
                        <span className="text-xs text-muted-foreground"> ×2</span>
                        {slot2.description && <p className="text-xs text-muted-foreground mt-0.5">{slot2.description}</p>}
                      </OptionBtn>
                    )}
                    {slot1 && slot2 && (
                      <OptionBtn
                        selected={sel?.type === "ab"}
                        onClick={() => setDay(num, sel?.type === "ab" ? null : { type: "ab" })}
                        className="col-span-2"
                      >
                        <span className="font-medium">One of each</span>
                        <p className="text-xs text-muted-foreground">{slot1.name} + {slot2.name}</p>
                      </OptionBtn>
                    )}
                    <OptionBtn
                      selected={isCustom}
                      onClick={() => setDay(num, isCustom ? null : { type: "custom", notes: "" })}
                      className="col-span-2"
                    >
                      <span className="font-medium">Custom note</span>
                    </OptionBtn>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {slot1 && (
                      <OptionBtn
                        selected={sel?.type === "a"}
                        onClick={() => setDay(num, sel?.type === "a" ? null : { type: "a" })}
                      >
                        <span className="font-medium">{slot1.name}</span>
                        {slot1.description && <p className="text-xs text-muted-foreground mt-0.5">{slot1.description}</p>}
                      </OptionBtn>
                    )}
                    {slot2 && (
                      <OptionBtn
                        selected={sel?.type === "b"}
                        onClick={() => setDay(num, sel?.type === "b" ? null : { type: "b" })}
                      >
                        <span className="font-medium">{slot2.name}</span>
                        {slot2.description && <p className="text-xs text-muted-foreground mt-0.5">{slot2.description}</p>}
                      </OptionBtn>
                    )}
                    <OptionBtn
                      selected={isCustom}
                      onClick={() => setDay(num, isCustom ? null : { type: "custom", notes: "" })}
                      className="col-span-2"
                    >
                      <span className="font-medium">Custom note</span>
                    </OptionBtn>
                  </div>
                )}

                {isCustom && (
                  <textarea
                    placeholder="Describe what you'd like the kitchen to prepare…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={2}
                    value={(sel as { type: "custom"; notes: string }).notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setDay(num, { type: "custom", notes: e.target.value })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
        <Button className="w-full" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save Meal Selections"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function OptionBtn({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-2 text-left text-sm transition-colors ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:border-primary/50"
      } ${className}`}
    >
      {children}
    </button>
  );
}
