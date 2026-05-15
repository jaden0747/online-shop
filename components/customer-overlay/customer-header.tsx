"use client";

import { forwardRef, useImperativeHandle, useState, useTransition } from "react";
import { DialogTitle } from "@/components/ui/dialog";
import { updateCustomerInfoAction } from "@/app/actions/customers";
import type { Customer } from "@/lib/data/types";
import type { SectionRef } from "./section-ref";
import { Check, Copy, Pencil, X } from "lucide-react";

export const CustomerHeader = forwardRef<
  SectionRef,
  {
    customer: Customer;
    customerId: string;
    onSaved: (newId: string) => void;
  }
>(function CustomerHeader({ customer, customerId, onSaved }, ref) {
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: "", phone: "", zone: "" });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useImperativeHandle(ref, () => ({
    closeOpenForm: () => {
      if (editingInfo) {
        setEditingInfo(false);
        return true;
      }
      return false;
    },
    reset: () => {
      setEditingInfo(false);
      setCopiedKey(null);
    },
  }));

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  function startEditInfo() {
    setInfoForm({ name: customer.name, phone: customer.phone, zone: customer.zone });
    setEditingInfo(true);
  }

  function saveInfo() {
    if (!infoForm.name.trim() || !infoForm.phone.trim()) return;
    startTransition(async () => {
      const { newId } = await updateCustomerInfoAction(customerId, infoForm);
      setEditingInfo(false);
      onSaved(newId);
    });
  }

  if (editingInfo) {
    return (
      <div className="space-y-2">
        <input
          autoFocus
          className="w-full text-lg font-semibold bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
          value={infoForm.name}
          onChange={(e) => setInfoForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Name"
        />
        <input
          className="w-full text-sm bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
          value={infoForm.phone}
          onChange={(e) => setInfoForm((p) => ({ ...p, phone: e.target.value }))}
          placeholder="Phone"
        />
        <input
          className="w-full text-sm bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
          value={infoForm.zone}
          onChange={(e) => setInfoForm((p) => ({ ...p, zone: e.target.value }))}
          placeholder="Zone (optional)"
        />
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={saveInfo}
            disabled={isPending || !infoForm.name.trim() || !infoForm.phone.trim()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check size={11} /> Save
          </button>
          <button
            type="button"
            onClick={() => setEditingInfo(false)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border hover:bg-accent"
          >
            <X size={11} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 pr-12">
      <div className="flex items-center gap-2">
        <DialogTitle>{customer.name}</DialogTitle>
        <button
          type="button"
          onClick={startEditInfo}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Edit name / phone / zone"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => copyToClipboard(customer.name, "name")}
          className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Copy name"
        >
          {copiedKey === "name" ? (
            <Check size={12} className="text-green-500" />
          ) : (
            <Copy size={12} />
          )}
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <a
          href={`https://zalo.me/${customer.phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-blue-500 transition-colors"
          title="Open in Zalo"
        >
          {customer.phone}
        </a>
        <button
          type="button"
          onClick={() => copyToClipboard(customer.phone, "phone")}
          className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Copy phone"
        >
          {copiedKey === "phone" ? (
            <Check size={11} className="text-green-500" />
          ) : (
            <Copy size={11} />
          )}
        </button>
      </div>
    </div>
  );
});
