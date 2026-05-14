"use client";

import { useState, useTransition } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { createCostItemAction, deleteCostItemAction, updateCostItemAction } from "@/app/actions/cost-items";
import { upsertWeeklyOpsAction } from "@/app/actions/operations";
import type { CostCategory, CostItem, WeeklyOps } from "@/lib/data/types";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";

// ── Add Cost Item Form ────────────────────────────────────────────────────────
function AddCostItemForm({
  weekLabel,
  categories,
  onAdded,
}: {
  weekLabel: string;
  categories: CostCategory[];
  onAdded: (item: CostItem) => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, startSave] = useTransition();

  function handleAdd() {
    const amt = parseFloat(amount);
    if (!amt || !categoryId) return;
    startSave(async () => {
      await createCostItemAction({ weekLabel, categoryId, amount: amt, note: note.trim() || null });
      onAdded({
        id: Math.random().toString(),
        weekLabel,
        categoryId,
        amount: amt,
        note: note.trim() || null,
        createdAt: new Date().toISOString(),
      });
      setAmount("");
      setNote("");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
      <select
        className="border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      >
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <FormattedAmountInput
        className="w-28 text-sm"
        placeholder="Amount"
        value={amount}
        onChange={(raw) => setAmount(raw)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
      />
      <input
        type="text"
        className="flex-1 min-w-[140px] border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
      />
      <button type="button" onClick={handleAdd} disabled={saving || !amount || !categoryId}
        className="flex items-center gap-1 px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        <Plus size={13} /> Add
      </button>
    </div>
  );
}

// ── Weekly Ops Form ───────────────────────────────────────────────────────────
function WeeklyOpsForm({
  weekLabel,
  initial,
}: {
  weekLabel: string;
  initial: WeeklyOps | null;
}) {
  const [prepared, setPrepared] = useState(String(initial?.mealsPrepared ?? ""));
  const [delivered, setDelivered] = useState(String(initial?.mealsDelivered ?? ""));
  const [wasted, setWasted] = useState(String(initial?.wastedMeals ?? ""));
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startSave(async () => {
      await upsertWeeklyOpsAction({
        weekLabel,
        mealsPrepared: parseInt(prepared) || 0,
        mealsDelivered: parseInt(delivered) || 0,
        wastedMeals: parseInt(wasted) || 0,
        note: note.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const inp = "w-20 border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground text-xs w-20">Prepared</span>
          <input className={inp} type="number" min={0} value={prepared} onChange={(e) => setPrepared(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground text-xs w-20">Delivered</span>
          <input className={inp} type="number" min={0} value={delivered} onChange={(e) => setDelivered(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground text-xs w-20">Wasted</span>
          <input className={inp} type="number" min={0} value={wasted} onChange={(e) => setWasted(e.target.value)} />
        </label>
      </div>
      {parseInt(prepared) > 0 && (
        <p className="text-xs text-muted-foreground">
          Waste rate: {prepared && parseInt(prepared) > 0 ? ((parseInt(wasted) / parseInt(prepared)) * 100).toFixed(1) : "—"}%
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saved ? <Check size={13} /> : null} Save
        </button>
      </div>
    </div>
  );
}

// ── Cost Item Row ─────────────────────────────────────────────────────────────
function CostItemRow({
  item,
  categoryName,
  onDelete,
}: {
  item: CostItem;
  categoryName: string;
  onDelete: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    startDelete(async () => {
      await deleteCostItemAction(item.id);
      onDelete(item.id);
    });
  }

  return (
    <div className="flex items-center gap-2 text-sm group py-0.5">
      <span className="text-muted-foreground text-xs w-24 shrink-0">{categoryName}</span>
      <span className="font-medium">₫{item.amount.toLocaleString()}</span>
      {item.note && <span className="text-muted-foreground text-xs flex-1 truncate">{item.note}</span>}
      <button type="button" onClick={handleDelete} disabled={deleting}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 ml-auto disabled:opacity-50 shrink-0">
        <X size={11} />
      </button>
    </div>
  );
}

// ── Main CostsPanel ───────────────────────────────────────────────────────────
export function CostsPanel({
  weekLabel,
  categories,
  initialItems,
  initialOps,
}: {
  weekLabel: string;
  categories: CostCategory[];
  initialItems: CostItem[];
  initialOps: WeeklyOps | null;
}) {
  const [items, setItems] = useState(initialItems);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // Group by category
  const grouped = categories.map((c) => ({
    category: c,
    items: items.filter((i) => i.categoryId === c.id),
    total: items.filter((i) => i.categoryId === c.id).reduce((s, i) => s + i.amount, 0),
  })).filter((g) => g.items.length > 0);

  const grandTotal = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      {/* Cost Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Cost Breakdown</h3>
          <span className="text-sm font-medium text-muted-foreground">
            Total: <span className="text-foreground">₫{grandTotal.toLocaleString()}</span>
          </span>
        </div>

        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">No cost items this week. Add one below.</p>
        )}

        {grouped.map((g) => (
          <div key={g.category.id} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{g.category.name}</p>
              <span className="text-sm text-muted-foreground">₫{g.total.toLocaleString()}</span>
            </div>
            <div className="pl-2 border-l-2 border-muted space-y-0.5">
              {g.items.map((item) => (
                <CostItemRow
                  key={item.id}
                  item={item}
                  categoryName={catMap.get(item.categoryId) ?? item.categoryId}
                  onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                />
              ))}
            </div>
          </div>
        ))}

        <AddCostItemForm
          weekLabel={weekLabel}
          categories={categories}
          onAdded={(item) => setItems((prev) => [...prev, item])}
        />
      </div>

      {/* Operations */}
      <div className="space-y-3 pt-4 border-t">
        <h3 className="text-base font-semibold">Operations Metrics</h3>
        <WeeklyOpsForm weekLabel={weekLabel} initial={initialOps} />
      </div>
    </div>
  );
}
