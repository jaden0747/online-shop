"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ShippingCustomerCell } from "./customer-overlay-trigger";
import {
  depotAwareClusters,
  fixedKClusters,
  clustersFromAssignments,
  CLUSTER_COLORS,
  DEFAULT_CONSTRAINTS,
  type Constraints,
} from "../route/clustering";

// Must match the getWeekLabel algorithm in route-map.tsx (ISO-based)
function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diffMs = d.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceColor(km: number): { text: string; bar: string } {
  if (km <= 3) return { text: "text-green-600", bar: "bg-green-500" };
  if (km <= 7) return { text: "text-yellow-600", bar: "bg-yellow-500" };
  if (km <= 12) return { text: "text-orange-600", bar: "bg-orange-500" };
  return { text: "text-red-600", bar: "bg-red-500" };
}

export function ShippingTable({
  deliveries,
  date,
  notes = [],
  permanentNotes = [],
  defaultHub,
  // TODO: wire up CustomerOverlay when implemented
  onCustomerClick,
}: {
  deliveries: Delivery[];
  date: string;
  notes?: { customerId: string; note: string }[];
  permanentNotes?: { customerId: string; note: string | null }[];
  defaultHub?: { lat: number; lng: number };
  onCustomerClick?: (customerId: string) => void;
}) {
  const [hub, setHub] = useState(defaultHub ?? DEFAULT_HUB);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [manualK, setManualK] = useState<number | null>(null);
  const [manualAssign, setManualAssign] = useState<Map<string, number>>(new Map());
  const [manualOrder, setManualOrder] = useState<Map<number, string[]>>(new Map());
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
    } else if (defaultHub) {
      // If no localStorage override, use the server-provided hub
      setHub(defaultHub);
    }
    const cStr = localStorage.getItem("route_constraints");
    if (cStr) {
      try { setConstraints(JSON.parse(cStr)); } catch { /* ignore */ }
    }
    // Restore manual assignments and stop order from the Route page
    try {
      const savedOverrides = localStorage.getItem(`route-overrides-${date}`);
      if (savedOverrides) {
        const overrides = JSON.parse(savedOverrides) as Record<string, number>;
        setManualAssign(new Map(Object.entries(overrides)));
      }
      const savedOrder = localStorage.getItem(`route_order_${date}`);
      if (savedOrder) {
        setManualOrder(new Map(JSON.parse(savedOrder) as [number, string[]][]));
      }
    } catch { /* ignore */ }
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const base = manualK !== null
      ? fixedKClusters(points, hub, manualK)
      : depotAwareClusters(points, hub, constraints);
    if (manualAssign.size === 0) return base;
    // Apply manual cluster assignments from the Route page
    const assignments = base.assignments.slice();
    withCoords.forEach((d, i) => {
      const override = manualAssign.get(d.customerId);
      if (override !== undefined) assignments[i] = override;
    });
    return clustersFromAssignments(points, hub, assignments);
  }, [ready, withCoords, hub, constraints, manualK, manualAssign]);

  // Build sorted rows: by shipper# then by delivery order within shipper
  const sortedRows = useMemo(() => {
    if (cluster.k === 0) return withCoords.map((d) => ({ delivery: d, shipper: null as number | null, stop: null as number | null }));
    const rows: { delivery: typeof effectiveDeliveries[number]; shipper: number; stop: number }[] = [];
    for (let ci = 0; ci < cluster.k; ci++) {
      const algorithmStops = cluster.routes[ci].map((i) => withCoords[i]);
      const customOrder = manualOrder.get(ci);
      let stops: typeof effectiveDeliveries[number][];
      if (customOrder) {
        const stopMap = new Map(algorithmStops.map((d) => [d.customerId, d]));
        stops = customOrder
          .map((id) => stopMap.get(id))
          .filter((d): d is typeof effectiveDeliveries[number] => d !== undefined);
        for (const d of algorithmStops) {
          if (!customOrder.includes(d.customerId)) stops.push(d);
        }
      } else {
        stops = algorithmStops;
      }
      stops.forEach((d, stopIdx) => {
        rows.push({ delivery: d, shipper: ci, stop: stopIdx + 1 });
      });
    }
    return rows;
  }, [cluster, withCoords, effectiveDeliveries, manualOrder]);

  const tableRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  const captureTablePng = async (): Promise<Blob> => {
    if (!tableRef.current) throw new Error("table not mounted");
    const { toPng } = await import("html-to-image");
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    const backgroundColor = bg ? `hsl(${bg})` : (document.documentElement.classList.contains("dark") ? "#0f172a" : "#ffffff");
    const dataUrl = await toPng(tableRef.current, { backgroundColor, pixelRatio: 2 });
    const res = await fetch(dataUrl);
    return res.blob();
  };

  const handleExportPNG = async () => {
    const blob = await captureTablePng();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipping-${date}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleCopyPNG = async () => {
    setCopying(true);
    try {
      const blobPromise = captureTablePng();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    } catch (e) {
      console.error("Copy to clipboard failed:", e);
    } finally {
      setCopying(false);
    }
  };

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
        <span className="text-muted-foreground">
          {cluster.k > 0 ? `${cluster.k} shipper${cluster.k > 1 ? "s" : ""} planned` : "no route planned"}
        </span>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={handleExportPNG}
            className="h-7 px-3 text-xs rounded border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            title="Download shipping table as PNG"
          >
            Export PNG
          </button>
          <button
            type="button"
            onClick={handleCopyPNG}
            disabled={copying}
            className="h-7 px-3 text-xs rounded border bg-background hover:bg-accent transition-colors disabled:opacity-50"
            title="Copy shipping table PNG to clipboard"
          >
            {copying ? "Copying…" : "Copy PNG"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto" ref={tableRef}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-2 py-1.5 font-medium w-8">#</th>
              <th className="text-left px-2 py-1.5 font-medium w-16">Shipper</th>
              <th className="text-left px-2 py-1.5 font-medium">Customer</th>
              <th className="text-left px-2 py-1.5 font-medium">Address</th>
              <th className="text-left px-2 py-1.5 font-medium">Zone</th>
              <th className="text-left px-2 py-1.5 font-medium">Dist</th>
              <th className="text-left px-2 py-1.5 font-medium">Today&apos;s Meals</th>
              <th className="text-left px-2 py-1.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  No deliveries scheduled for today.
                </td>
              </tr>
            )}
            {sortedRows.map((row, idx) => {
              const d = row.delivery;
              const color = row.shipper !== null ? CLUSTER_COLORS[row.shipper % CLUSTER_COLORS.length] : null;
              const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
              const permanentNote = permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
              return (
                <tr key={d.customerId} className="hover:bg-accent/50 transition-colors">
                  <td className="px-2 py-1.5 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="px-2 py-1.5">
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
                  <td className="px-2 py-1.5">
                    <ShippingCustomerCell
                      customerId={d.customerId}
                      name={d.name}
                      phone={d.phone}
                      permanentNote={permanentNote}
                    />
                  </td>
                  <td className="px-2 py-1.5 max-w-[200px]">
                    <AddressCell
                      delivery={d}
                      selectedId={selectedAddressIds.get(d.customerId) ?? d.defaultAddressId}
                      onChange={(id) => setSelectedAddressIds((prev) => new Map(prev).set(d.customerId, id))}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs">{d.zone}</td>
                  <td className="px-2 py-1.5">
                    {d.lat !== null && d.lng !== null ? (() => {
                      const km = haversineKm(hub.lat, hub.lng, d.lat, d.lng);
                      const { text, bar } = distanceColor(km);
                      const barWidthPct = Math.min(100, (km / 12) * 100);
                      return (
                        <div className="space-y-1 min-w-[52px]">
                          <span className={`text-xs font-medium ${text}`}>{km.toFixed(1)}km</span>
                          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${bar}`} style={{ width: `${barWidthPct}%` }} />
                          </div>
                        </div>
                      );
                    })() : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 max-w-[260px]">
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
                  <td className="px-2 py-1.5 max-w-[180px]">
                    {note ? (
                      <span className="text-xs text-blue-700 whitespace-pre-wrap">{note}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Deliveries without coordinates appear at bottom unsorted */}
            {cluster.k > 0 && withoutCoords.map((d) => {
              const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
              const permanentNote = permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
              return (
                <tr key={d.customerId} className="hover:bg-accent/50 transition-colors bg-amber-50/30">
                  <td className="px-2 py-1.5 text-muted-foreground text-xs">—</td>
                  <td className="px-2 py-1.5">
                    <span className="text-[10px] text-amber-700" title="No coordinates set">no coord</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <ShippingCustomerCell
                      customerId={d.customerId}
                      name={d.name}
                      phone={d.phone}
                      permanentNote={permanentNote}
                    />
                  </td>
                  <td className="px-2 py-1.5 max-w-[200px]">
                    <AddressCell
                      delivery={d}
                      selectedId={selectedAddressIds.get(d.customerId) ?? d.defaultAddressId}
                      onChange={(id) => setSelectedAddressIds((prev) => new Map(prev).set(d.customerId, id))}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-xs">{d.zone}</td>
                  <td className="px-2 py-1.5">
                    <span className="text-xs text-muted-foreground">—</span>
                  </td>
                  <td className="px-2 py-1.5 max-w-[260px]">
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
                  <td className="px-2 py-1.5 max-w-[180px]">
                    {note ? (
                      <span className="text-xs text-blue-700 whitespace-pre-wrap">{note}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
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
    return <span className="text-xs">{delivery.address}</span>;
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
          <option key={a.id} value={a.id} title={a.label}>
            {a.address}{a.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
