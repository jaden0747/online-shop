"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "../actions/customers";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  notes: string | null;
};

type Sub = {
  customerId: string;
  plan: string;
  goal: string;
  mealsPerDay: number;
  status: string;
  startDate: string;
  renewalDate: string;
};

type Props = {
  customers: Customer[];
  subscriptions: Sub[];
};

function EditableCell({
  value,
  customerId,
  field,
  className,
  onSave,
}: {
  value: string;
  customerId: string;
  field: string;
  className?: string;
  onSave: (customerId: string, field: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditValue(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function save() {
    setEditing(false);
    if (editValue !== value) {
      onSave(customerId, field, editValue);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") { setEditValue(value); setEditing(false); }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className={`w-full bg-transparent border-b border-primary outline-none text-sm px-0 py-0 ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 ${className ?? ""}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground">—</span>}
    </span>
  );
}

export function InlineCustomerTable({ customers, subscriptions }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : customers;

  async function handleSave(customerId: string, field: string, value: string) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const fd = new FormData();
    fd.set("name", field === "name" ? value : customer.name);
    fd.set("phone", field === "phone" ? value : customer.phone);
    fd.set("address", field === "address" ? value : customer.address);
    fd.set("zone", field === "zone" ? value : customer.zone);
    fd.set("notes", field === "notes" ? value : (customer.notes ?? ""));

    await updateCustomerAction(customerId, fd);
    router.refresh();
  }

  return (
    <div>
      <div className="px-4 py-2 border-b">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-2 font-medium">Phone</th>
            <th className="text-left px-4 py-2 font-medium">Name</th>
            <th className="text-left px-4 py-2 font-medium">Address</th>
            <th className="text-left px-4 py-2 font-medium">Zone</th>
            <th className="text-left px-4 py-2 font-medium">Subscription</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                {search.trim() ? `No customers matching "${search}"` : "No customers yet. Add your first one."}
              </td>
            </tr>
          )}
          {filtered.map((c) => {
            const sub = subscriptions.find(
              (s) => s.customerId === c.phone && isSubscriptionLive(s.status, s.startDate, s.renewalDate)
            ) ?? null;

            return (
              <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-2">
                  <Link
                    href={`/customers/${encodeURIComponent(c.phone)}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {c.phone}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <EditableCell value={c.name} customerId={c.id} field="name" onSave={handleSave} className="font-medium" />
                </td>
                <td className="px-4 py-2">
                  <EditableCell value={c.address} customerId={c.id} field="address" onSave={handleSave} />
                </td>
                <td className="px-4 py-2">
                  <EditableCell value={c.zone} customerId={c.id} field="zone" onSave={handleSave} />
                </td>
                <td className="px-4 py-2">
                  {sub ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="default" className="capitalize">{sub.plan}</Badge>
                      <Badge variant="outline" className="capitalize text-xs">{sub.goal}</Badge>
                      <Badge variant="outline" className="text-xs">{sub.mealsPerDay}×/day</Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
