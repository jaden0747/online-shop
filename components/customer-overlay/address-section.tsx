"use client";

import { forwardRef, useImperativeHandle, useState, useTransition } from "react";
import {
  addAddressAction,
  updateAddressFieldsAction,
  deleteAddressAction,
  setDefaultAddressAction,
} from "@/app/actions/customers";
import type { CustomerAddress } from "@/lib/data/types";
import type { SectionRef } from "./section-ref";
import type { RouteMap } from "./types";
import { CoordsEditor } from "./coords-editor";
import { Check, Copy, Pencil, Plus, Star, Trash2, X } from "lucide-react";

function getRouteInfo(routes: RouteMap, loadingRoutes: boolean, addrId: string) {
  const route = routes.get(addrId);
  if (route) {
    return (
      <span className="text-[10px] text-emerald-600">
        {(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} min
      </span>
    );
  }
  if (loadingRoutes) {
    return <span className="text-[10px] text-muted-foreground/40">Loading route...</span>;
  }
  return null;
}

export const AddressSection = forwardRef<
  SectionRef,
  {
    addresses: CustomerAddress[];
    customerId: string;
    routes: RouteMap;
    loadingRoutes: boolean;
    onReload: () => void;
  }
>(function AddressSection({ addresses, customerId, routes, loadingRoutes, onReload }, ref) {
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({ label: "", address: "", zone: "" });
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ label: "", address: "", zone: "" });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useImperativeHandle(ref, () => ({
    closeOpenForm: () => {
      if (editingAddrId !== null) {
        setEditingAddrId(null);
        return true;
      }
      if (showAddAddr) {
        setShowAddAddr(false);
        return true;
      }
      return false;
    },
    reset: () => {
      setEditingAddrId(null);
      setShowAddAddr(false);
      setNewAddr({ label: "", address: "", zone: "" });
      setCopiedKey(null);
    },
  }));

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  function startEditAddr(addr: CustomerAddress) {
    setAddrForm({ label: addr.label, address: addr.address, zone: addr.zone });
    setEditingAddrId(addr.id);
    setShowAddAddr(false);
  }

  function saveEditAddr(id: string) {
    startTransition(async () => {
      await updateAddressFieldsAction(id, addrForm);
      setEditingAddrId(null);
      onReload();
    });
  }

  function handleDeleteAddr(id: string) {
    startTransition(async () => {
      await deleteAddressAction(id);
      onReload();
    });
  }

  function handleSetDefault(addressId: string) {
    startTransition(async () => {
      await setDefaultAddressAction(addressId, customerId);
      onReload();
    });
  }

  function saveNewAddr() {
    if (!newAddr.address.trim()) return;
    startTransition(async () => {
      await addAddressAction({
        ...newAddr,
        customerId,
        isDefault: addresses.length === 0,
      });
      setShowAddAddr(false);
      setNewAddr({ label: "", address: "", zone: "" });
      onReload();
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Addresses
        </p>
        {!showAddAddr && (
          <button
            type="button"
            onClick={() => {
              setShowAddAddr(true);
              setEditingAddrId(null);
            }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      {addresses.length === 0 && !showAddAddr && (
        <p className="text-xs text-muted-foreground/50">No addresses saved.</p>
      )}
      <ul className="space-y-1">
        {addresses.map((addr) =>
          editingAddrId === addr.id ? (
            <li key={addr.id} className="border rounded-lg p-2 space-y-1">
              <input
                autoFocus
                className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                value={addrForm.label}
                onChange={(e) => setAddrForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="Label"
              />
              <input
                className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                value={addrForm.address}
                onChange={(e) => setAddrForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Full address"
              />
              <input
                className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
                value={addrForm.zone}
                onChange={(e) => setAddrForm((p) => ({ ...p, zone: e.target.value }))}
                placeholder="Zone"
              />
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => saveEditAddr(addr.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Check size={10} /> Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAddrId(null)}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border hover:bg-accent"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </li>
          ) : (
            <li key={addr.id} className="flex items-start gap-1.5 group text-xs">
              {addr.isDefault ? (
                <Star size={10} className="text-primary shrink-0 mt-0.5" />
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetDefault(addr.id)}
                  title="Set as default"
                  className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground shrink-0 mt-0.5"
                >
                  <Star size={10} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                {addr.label && (
                  <span className={addr.isDefault ? "font-medium" : "text-muted-foreground"}>
                    {addr.label}{" "}
                  </span>
                )}
                <span className="text-muted-foreground break-words">{addr.address}</span>
                {addr.zone && (
                  <span className="text-muted-foreground/60"> · {addr.zone}</span>
                )}
                <CoordsEditor
                  addressId={addr.id}
                  customerId={customerId}
                  lat={addr.latitude}
                  lng={addr.longitude}
                  onSaved={onReload}
                />
                {addr.latitude != null &&
                  addr.longitude != null &&
                  getRouteInfo(routes, loadingRoutes, addr.id)}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(addr.address, `addr-${addr.id}`)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                  title="Copy address"
                >
                  {copiedKey === `addr-${addr.id}` ? (
                    <Check size={10} className="text-green-500" />
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => startEditAddr(addr)}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Pencil size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAddr(addr.id)}
                  disabled={isPending}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-accent disabled:opacity-50"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </li>
          )
        )}
        {showAddAddr && (
          <li className="border rounded-lg p-2 space-y-1">
            <input
              autoFocus
              className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
              value={newAddr.label}
              onChange={(e) => setNewAddr((p) => ({ ...p, label: e.target.value }))}
              placeholder="Label (e.g. Home)"
            />
            <input
              className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
              value={newAddr.address}
              onChange={(e) => setNewAddr((p) => ({ ...p, address: e.target.value }))}
              placeholder="Full address"
            />
            <input
              className="w-full bg-transparent border-b border-input outline-none focus:border-ring text-xs pb-0.5"
              value={newAddr.zone}
              onChange={(e) => setNewAddr((p) => ({ ...p, zone: e.target.value }))}
              placeholder="Zone"
            />
            <div className="flex gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={saveNewAddr}
                disabled={isPending || !newAddr.address.trim()}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check size={10} /> Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddAddr(false);
                  setNewAddr({ label: "", address: "", zone: "" });
                }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border hover:bg-accent"
              >
                <X size={10} /> Cancel
              </button>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
});
