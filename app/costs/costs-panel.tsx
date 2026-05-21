"use client";

import { useState, useTransition } from "react";
import { Plus, X, Check } from "lucide-react";
import { createCostItemAction, deleteCostItemAction } from "@/app/actions/cost-items";
import { upsertWeeklyOpsAction } from "@/app/actions/operations";
import type { CostCategory, CostItem, WeeklyOps } from "@/lib/data/types";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { CostOverview } from "./cost-overview";
import type { WeekSummary } from "./cost-types";

const inp = "border rounded px-2 py-0.5 text-xs bg-background outline-none focus:ring-1 focus:ring-ring";

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
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState("");
  const [saving, startSave] = useTransition();

  function handleAdd() {
    const amt = parseFloat(amount);
    if (!amt || !categoryId) return;
    const dateVal = date.trim() || null;
    const noteVal = note.trim() || null;
    const sourceVal = source.trim() || null;
    startSave(async () => {
      await createCostItemAction({ weekLabel, categoryId, amount: amt, date: dateVal, note: noteVal, source: sourceVal });
      onAdded({
        id: Math.random().toString(),
        weekLabel, categoryId, amount: amt,
        date: dateVal, note: noteVal, source: sourceVal,
        createdAt: new Date().toISOString(),
      });
      setAmount(""); setDate(""); setNote(""); setSource("");
    });
  }

  return (
    <div className="space-y-1">
      {/* Required */}
      <div className="flex flex-wrap gap-1">
        <select className={inp} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <FormattedAmountInput
          className="w-20 h-auto py-0.5 px-2 text-xs rounded"
          placeholder="Amount"
          value={amount}
          onChange={(raw) => setAmount(raw)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          type="button" onClick={handleAdd} disabled={saving || !amount || !categoryId}
          className="flex items-center gap-0.5 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus size={10} /> Add
        </button>
      </div>
      {/* Optional */}
      <div className="flex flex-wrap gap-1">
        <input
          type="text" className={`${inp} w-36`}
          placeholder="Note — what was bought"
          value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <input
          type="text" className={`${inp} w-24`}
          placeholder="Source — chợ / BHX…"
          value={source} onChange={(e) => setSource(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
      </div>
    </div>
  );
}

// ── Weekly Ops Form ───────────────────────────────────────────────────────────
function WeeklyOpsForm({ weekLabel, initial }: { weekLabel: string; initial: WeeklyOps | null }) {
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

  const numInp = `${inp} w-12`;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <label className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-14">Prepared</span>
          <input className={numInp} type="number" min={0} value={prepared} onChange={(e) => setPrepared(e.target.value)} />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-14">Delivered</span>
          <input className={numInp} type="number" min={0} value={delivered} onChange={(e) => setDelivered(e.target.value)} />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-14">Wasted</span>
          <input className={numInp} type="number" min={0} value={wasted} onChange={(e) => setWasted(e.target.value)} />
        </label>
      </div>
      {parseInt(prepared) > 0 && (
        <p className="text-xs text-muted-foreground">
          Waste: {((parseInt(wasted) / parseInt(prepared)) * 100).toFixed(1)}%
        </p>
      )}
      <div className="flex gap-1">
        <input
          className={`${inp} flex-1`}
          placeholder="Note (optional)"
          value={note} onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-0.5 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saved ? <Check size={10} /> : null} Save
        </button>
      </div>
    </div>
  );
}

// ── Cost Item Row (compact, no category — shown in group header) ──────────────
function parsePortionCount(source: string | null): number | null {
  if (!source) return null;
  const m = source.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function CostItemRow({
  item,
  isShipping,
  onDelete,
}: {
  item: CostItem;
  isShipping: boolean;
  onDelete: (id: string) => void;
}) {
  const [deleting, startDelete] = useTransition();

  const dateLabel = item.date
    ? new Date(item.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
    : null;

  const portionCount = isShipping ? parsePortionCount(item.source) : null;
  const costPerBox = portionCount && portionCount > 0 ? Math.round(item.amount / portionCount) : null;

  return (
    <tr className="group">
      <td className="py-px pr-2 text-muted-foreground whitespace-nowrap">{dateLabel ?? ""}</td>
      <td className="py-px pr-2 font-medium tabular-nums text-right whitespace-nowrap">{item.amount.toLocaleString()}₫</td>
      <td className="py-px pr-2 text-muted-foreground max-w-[8rem] truncate">{item.note ?? ""}</td>
      <td className="py-px pr-1 text-muted-foreground italic whitespace-nowrap">
        {item.source ?? ""}
        {costPerBox && (
          <span className="ml-1 not-italic font-medium text-foreground">· {costPerBox.toLocaleString()}₫/hộp</span>
        )}
      </td>
      <td className="py-px w-4">
        <button
          type="button"
          onClick={() => startDelete(async () => { await deleteCostItemAction(item.id); onDelete(item.id); })}
          disabled={deleting}
          className="h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 disabled:opacity-50"
        >
          <X size={10} />
        </button>
      </td>
    </tr>
  );
}

// ── Main CostsPanel ───────────────────────────────────────────────────────────
export function CostsPanel({
  weekLabel,
  categories,
  initialItems,
  initialOps,
  shippingCategoryId,
  summaries,
}: {
  weekLabel: string;
  categories: CostCategory[];
  initialItems: CostItem[];
  initialOps: WeeklyOps | null;
  shippingCategoryId: string | null;
  summaries: WeekSummary[];
}) {
  const [items, setItems] = useState(initialItems);

  const grouped = categories
    .map((c) => ({
      category: c,
      items: items.filter((i) => i.categoryId === c.id),
      total: items.filter((i) => i.categoryId === c.id).reduce((s, i) => s + i.amount, 0),
    }))
    .filter((g) => g.items.length > 0);

  const grandTotal = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="grid grid-cols-2 divide-x gap-0">

      {/* Left — input forms */}
      <div className="pr-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">All Weeks</p>
          <CostOverview summaries={summaries} currentWeek={weekLabel} />
        </div>
        <div className="border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Operations</p>
          <WeeklyOpsForm weekLabel={weekLabel} initial={initialOps} />
        </div>
        <div className="border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Add Cost</p>
          <AddCostItemForm
            weekLabel={weekLabel}
            categories={categories}
            onAdded={(item) => setItems((prev) => [...prev, item])}
          />
        </div>
      </div>

      {/* Right — cost breakdown */}
      <div className="pl-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Breakdown</p>

        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <tbody>
              {grouped.map((g) => (
                <>
                  {/* Category header row */}
                  <tr key={`hd-${g.category.id}`} className="border-t first:border-t-0">
                    <td colSpan={4} className="pt-2 pb-0.5 font-semibold">{g.category.name}</td>
                    <td className="pt-2 pb-0.5 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                      {g.total.toLocaleString()}₫
                    </td>
                  </tr>
                  {/* Item rows */}
                  {g.items.map((item) => (
                    <CostItemRow
                      key={item.id}
                      item={item}
                      isShipping={item.categoryId === shippingCategoryId}
                      onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
                    />
                  ))}
                </>
              ))}
              {/* Grand total */}
              <tr className="border-t">
                <td colSpan={3} className="pt-1.5 font-semibold">Total</td>
                <td colSpan={2} className="pt-1.5 font-semibold text-right tabular-nums whitespace-nowrap">
                  {grandTotal.toLocaleString()}₫
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
