"use client";

import { useState, useTransition } from "react";
import { Plus, X, Pencil, Check, GripVertical } from "lucide-react";
import {
  createCostCategoryAction,
  updateCostCategoryAction,
  deleteCostCategoryAction,
} from "@/app/actions/cost-categories";
import type { CostCategory } from "@/lib/data/types";

export function CostCategoriesCard({ categories }: { categories: CostCategory[] }) {
  const [items, setItems] = useState(categories);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, startSave] = useTransition();

  function handleAdd() {
    if (!newName.trim()) return;
    startSave(async () => {
      await createCostCategoryAction({ name: newName.trim() });
      setItems((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          name: newName.trim(),
          sortOrder: prev.length,
          createdAt: new Date().toISOString(),
        },
      ]);
      setNewName("");
    });
  }

  function handleDelete(id: string) {
    startSave(async () => {
      await deleteCostCategoryAction(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function startEdit(c: CostCategory) {
    setEditingId(c.id);
    setEditName(c.name);
  }

  function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    startSave(async () => {
      await updateCostCategoryAction(id, { name: editName.trim() });
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name: editName.trim() } : c)));
      setEditingId(null);
    });
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {items.map((c, i) =>
          editingId === c.id ? (
            <li key={c.id} className="flex items-center gap-1">
              <GripVertical size={12} className="text-muted-foreground/30 shrink-0" />
              <input
                autoFocus
                className="flex-1 border rounded px-2 py-0.5 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit(c.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
              <button type="button" onClick={() => handleSaveEdit(c.id)} disabled={saving}
                className="h-6 w-6 flex items-center justify-center rounded text-emerald-600 hover:bg-accent disabled:opacity-50">
                <Check size={12} />
              </button>
              <button type="button" onClick={() => setEditingId(null)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-accent">
                <X size={12} />
              </button>
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-1 group text-sm">
              <GripVertical size={12} className="text-muted-foreground/30 shrink-0" />
              <span className="text-muted-foreground text-xs w-4">{i + 1}.</span>
              <span className="flex-1">{c.name}</span>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                <button type="button" onClick={() => startEdit(c)}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent">
                  <Pencil size={11} />
                </button>
                <button type="button" onClick={() => handleDelete(c.id)} disabled={saving}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-accent disabled:opacity-50">
                  <X size={11} />
                </button>
              </div>
            </li>
          )
        )}
      </ul>
      <div className="flex items-center gap-1 pt-1">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm bg-background outline-none focus:ring-1 focus:ring-ring"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
        />
        <button type="button" onClick={handleAdd} disabled={saving || !newName.trim()}
          className="flex items-center gap-1 px-2 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}
