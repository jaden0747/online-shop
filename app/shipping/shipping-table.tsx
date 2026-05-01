"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  depotAwareClusters,
  fixedKClusters,
  CLUSTER_COLORS,
  DEFAULT_CONSTRAINTS,
  type Constraints,
} from "../route/clustering";

type AddressOption = {
  id: string;
  label: string;
  address: string;
  zone: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
};

type Delivery = {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  plan: string;
  mealsPerDay: number;
  isReplacement: boolean;
  meals: string[];
  lat: number | null;
  lng: number | null;
  addresses: AddressOption[];
  defaultAddressId: string | null;
};

const DEFAULT_HUB = { lat: 10.7769, lng: 106.7009 };

export function ShippingTable({ deliveries, notes = [] }: { deliveries: Delivery[]; notes?: { customerId: string; note: string }[] }) {
  const [hub, setHub] = useState(DEFAULT_HUB);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [manualK, setManualK] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  // Map of customerId -> selected addressId
  const [selectedAddressIds, setSelectedAddressIds] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const d of deliveries) {
      if (d.defaultAddressId) m.set(d.customerId, d.defaultAddressId);
    }
    return m;
  });

  // Load route settings from localStorage (shared with /route page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hubStr = localStorage.getItem("route_hub");
    if (hubStr) {
      const m = hubStr.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
      if (m) setHub({ lat: parseFloat(m[1]), lng: parseFloat(m[2]) });
    }
    const cStr = localStorage.getItem("route_constraints");
    if (cStr) {
      try { setConstraints(JSON.parse(cStr)); } catch { /* ignore */ }
    }
    setReady(true);
  }, []);

  // Resolve effective address/zone/lat/lng for each delivery based on selection
  const effectiveDeliveries = useMemo(() => deliveries.map((d) => {
    const selId = selectedAddressIds.get(d.customerId) ?? d.defaultAddressId;
    if (!selId || d.addresses.length === 0) return d;
    const selAddr = d.addresses.find((a) => a.id === selId);
    if (!selAddr) return d;
    const isDefault = selAddr.id === d.defaultAddressId;
    return {
      ...d,
      address: selAddr.address,
      zone: selAddr.zone,
      lat: isDefault ? d.lat : (selAddr.latitude ?? null),
      lng: isDefault ? d.lng : (selAddr.longitude ?? null),
    };
  }), [deliveries, selectedAddressIds]);

  // Split deliveries: those with coordinates (assignable to a shipper) vs without
  const withCoords = useMemo(
    () => effectiveDeliveries.filter((d) => d.lat !== null && d.lng !== null),
    [effectiveDeliveries]
  );
  const withoutCoords = useMemo(
    () => effectiveDeliveries.filter((d) => d.lat === null || d.lng === null),
    [effectiveDeliveries]
  );

  // Run clustering only client-side (after localStorage loaded)
  const cluster = useMemo(() => {
    if (!ready || withCoords.length === 0) {
      return { assignments: [] as number[], routes: [] as number[][], k: 0 };
    }
    const points = withCoords.map((d) => ({ lat: d.lat as number, lng: d.lng as number }));
    if (manualK !== null) return fixedKClusters(points, hub, manualK);
    return depotAwareClusters(points, hub, constraints);
  }, [ready, withCoords, hub, constraints, manualK]);

  // Build sorted rows: by shipper# then by delivery order within shipper
  const sortedRows = useMemo(() => {
    if (cluster.k === 0) return withCoords.map((d) => ({ delivery: d, shipper: null as number | null, stop: null as number | null }));
    const rows: { delivery: typeof effectiveDeliveries[number]; shipper: number; stop: number }[] = [];
    for (let ci = 0; ci < cluster.k; ci++) {
      cluster.routes[ci].forEach((deliveryIdx, stopIdx) => {
        rows.push({ delivery: withCoords[deliveryIdx], shipper: ci, stop: stopIdx + 1 });
      });
    }
    return rows;
  }, [cluster, withCoords, effectiveDeliveries]);

  return (
    <div className="space-y-3">
      <div className="px-3 pt-2 flex items-center gap-3 text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-muted-foreground">Shippers:</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, withCoords.length)}
            value={manualK ?? cluster.k}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1) setManualK(v);
            }}
            className="h-7 w-16 px-2 border rounded text-sm"
          />
          {manualK !== null && (
            <button
              type="button"
              onClick={() => setManualK(null)}
              className="h-7 px-2 text-xs rounded border bg-background hover:bg-accent"
              title="Use auto"
            >
              Auto
            </button>
          )}
        </label>
        <span className="text-muted-foreground ml-auto">
          {cluster.k > 0 ? `${cluster.k} shipper${cluster.k > 1 ? "s" : ""} planned` : "no route planned"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium w-10">#</th>
              <th className="text-left px-3 py-2 font-medium w-20">Shipper</th>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-left px-3 py-2 font-medium">Phone</th>
              <th className="text-left px-3 py-2 font-medium">Address</th>
              <th className="text-left px-3 py-2 font-medium">Zone</th>
              <th className="text-left px-3 py-2 font-medium">Plan</th>
              <th className="text-left px-3 py-2 font-medium">Today&apos;s Meals</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">
                  No deliveries scheduled for today.
                </td>
              </tr>
            )}
            {sortedRows.map((row, idx) => {
              const d = row.delivery;
              const color = row.shipper !== null ? CLUSTER_COLORS[row.shipper % CLUSTER_COLORS.length] : null;
              const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
              return (
                <tr key={d.customerId} className="hover:bg-accent/50 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2">
                    {row.shipper !== null ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ background: color! }}
                        title={`Shipper ${row.shipper + 1}, stop #${row.stop}`}
                      >
                        S{row.shipper + 1}
                        <span className="opacity-80 text-[10px]">·{row.stop}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2">{d.phone}</td>
                  <td className="px-3 py-2 max-w-[220px]">
                    <AddressCell
                      delivery={d}
                      selectedId={selectedAddressIds.get(d.customerId) ?? d.defaultAddressId}
                      onChange={(id) => setSelectedAddressIds((prev) => new Map(prev).set(d.customerId, id))}
                    />
                  </td>
                  <td className="px-3 py-2">{d.zone}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="capitalize">{d.plan}</Badge>
                    <span className="ml-1 text-xs text-muted-foreground">{d.mealsPerDay}×</span>
                  </td>
                  <td className="px-3 py-2 max-w-[260px]">
                    {d.meals.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {d.meals.map((m, i) => (
                          <Badge key={i} variant="secondary" className="text-[11px] font-normal">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">not selected</span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[180px]">
                    {note ? (
                      <span className="text-xs text-blue-700 whitespace-pre-wrap">{note}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.isReplacement ? (
                      <Badge variant="secondary">Rescheduled</Badge>
                    ) : (
                      <Badge variant="default">Scheduled</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Deliveries without coordinates appear at bottom unsorted */}
            {cluster.k > 0 && withoutCoords.map((d) => {
              const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
              return (
              <tr key={d.customerId} className="hover:bg-accent/50 transition-colors bg-amber-50/30">
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2">
                  <span className="text-[10px] text-amber-700" title="No coordinates set">no coord</span>
                </td>
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2">{d.phone}</td>
                <td className="px-3 py-2 max-w-[220px]">
                  <AddressCell
                    delivery={d}
                    selectedId={selectedAddressIds.get(d.customerId) ?? d.defaultAddressId}
                    onChange={(id) => setSelectedAddressIds((prev) => new Map(prev).set(d.customerId, id))}
                  />
                </td>
                <td className="px-3 py-2">{d.zone}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="capitalize">{d.plan}</Badge>
                  <span className="ml-1 text-xs text-muted-foreground">{d.mealsPerDay}×</span>
                </td>
                <td className="px-3 py-2 max-w-[260px]">
                  {d.meals.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {d.meals.map((m, i) => (
                        <Badge key={i} variant="secondary" className="text-[11px] font-normal">{m}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">not selected</span>
                  )}
                </td>
                <td className="px-3 py-2 max-w-[180px]">
                  {note ? (
                    <span className="text-xs text-blue-700 whitespace-pre-wrap">{note}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {d.isReplacement ? (
                    <Badge variant="secondary">Rescheduled</Badge>
                  ) : (
                    <Badge variant="default">Scheduled</Badge>
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

function AddressCell({
  delivery,
  selectedId,
  onChange,
}: {
  delivery: Delivery;
  selectedId: string | null;
  onChange: (id: string) => void;
}) {
  const { addresses } = delivery;

  if (addresses.length <= 1) {
    return <span className="text-sm">{delivery.address}</span>;
  }

  const selected = addresses.find((a) => a.id === selectedId) ?? addresses.find((a) => a.isDefault) ?? addresses[0];

  return (
    <div className="space-y-1">
      <select
        value={selected?.id ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs border rounded px-1.5 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {addresses.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}{a.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground leading-tight">{selected?.address}</p>
    </div>
  );
}
