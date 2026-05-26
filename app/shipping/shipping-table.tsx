"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { CustomerOverlay } from "@/components/customer-overlay";
import { upsertDayAddressAction, deleteDayAddressAction } from "@/app/actions/order-day-addresses";
import {
  depotAwareClusters,
  fixedKClusters,
  clustersFromAssignments,
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
  mealSlots: number[];
  lat: number | null;
  lng: number | null;
  addresses: AddressOption[];
  defaultAddressId: string | null;
  effectiveAddressId: string | null;
  subscriptionId: string;
  weekLabel: string;
  day: number;
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

function CopyActions({
  customerId,
  name,
  phone,
  address,
  copiedKey,
  onCopy,
}: {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 pt-2">
      {([
        ["name", "Name", name],
        ["phone", "Phone", phone],
        ["addr", "Address", address],
      ] as const).map(([type, label, value]) => {
        const key = `${customerId}-${type}`;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onCopy(value, key)}
            title={`Copy ${type === "addr" ? "address" : type}`}
            aria-label={`Copy ${type === "addr" ? "address" : type}`}
            className="inline-flex h-6 items-center gap-1 rounded border border-transparent px-1.5 text-[11px] text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
          >
            {copiedKey === key ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CustomerCell({
  customerId,
  name,
  phone,
  address,
  copiedKey,
  onCopy,
}: {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        <button type="button" className="block text-left" onClick={() => setOpen(true)}>
          <span className="block text-sm font-semibold leading-snug hover:underline">{name}</span>
        </button>
        <a
          href={`https://zalo.me/${phone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs leading-none text-muted-foreground hover:text-blue-500"
        >
          {phone}
        </a>
      </div>
      <CopyActions
        customerId={customerId}
        name={name}
        phone={phone}
        address={address}
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
      {open && <CustomerOverlay customerId={customerId} open={open} onOpenChange={setOpen} />}
    </div>
  );
}

function NotesCell({ permanentNote, note }: { permanentNote: string | null; note: string | null }) {
  if (!permanentNote && !note) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  return (
    <div className="space-y-1.5 text-xs leading-snug">
      {permanentNote && (
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Permanent
          </span>
          <span className="block whitespace-pre-wrap break-words text-blue-600 dark:text-blue-400">
            {permanentNote}
          </span>
        </div>
      )}
      {note && (
        <div>
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Today
          </span>
          <span className="block whitespace-pre-wrap break-words text-blue-600 dark:text-blue-400">
            {note}
          </span>
        </div>
      )}
    </div>
  );
}

function MealsCell({ meals }: { meals: string[] }) {
  if (meals.length === 0) {
    return <span className="text-xs italic text-muted-foreground">not selected</span>;
  }

  return (
    <ol className="space-y-1">
      {meals.map((meal, index) => (
        <li
          key={`${meal}-${index}`}
          className="flex items-start gap-1.5 rounded-md border bg-secondary/50 px-2 py-1 text-xs leading-snug text-secondary-foreground"
        >
          <span className="mt-0.5 min-w-4 rounded bg-background/70 px-1 text-center text-[10px] font-medium text-muted-foreground">
            {index + 1}
          </span>
          <span className="min-w-0 whitespace-normal break-words">{meal}</span>
        </li>
      ))}
    </ol>
  );
}

export function ShippingTable({
  deliveries,
  date,
  notes = [],
  permanentNotes = [],
  defaultHub,
  menuOptionA = null,
  menuOptionB = null,
}: {
  deliveries: Delivery[];
  date: string;
  notes?: { customerId: string; note: string }[];
  permanentNotes?: { customerId: string; note: string | null }[];
  defaultHub?: { lat: number; lng: number };
  onCustomerClick?: (customerId: string) => void;
  menuOptionA?: string | null;
  menuOptionB?: string | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  const [hub, setHub] = useState(defaultHub ?? DEFAULT_HUB);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [manualK, setManualK] = useState<number | null>(null);
  const [manualAssign, setManualAssign] = useState<Map<string, number>>(new Map());
  const [manualOrder, setManualOrder] = useState<Map<number, string[]>>(new Map());
  const [ready, setReady] = useState(false);
  // Map of subscriptionId -> selected addressId
  const [selectedAddressIds, setSelectedAddressIds] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const d of deliveries) {
      if (d.effectiveAddressId) m.set(d.subscriptionId, d.effectiveAddressId);
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
    const savedK = localStorage.getItem("route_manual_k");
    if (savedK) { const k = parseInt(savedK, 10); if (!isNaN(k) && k >= 1) setManualK(k); }
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
  }, [date, defaultHub]);

  // Resolve effective address/zone/lat/lng for each delivery based on selection
  const effectiveDeliveries = useMemo(() => deliveries.map((d) => {
    const selId = selectedAddressIds.get(d.subscriptionId) ?? d.defaultAddressId;
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
      const override = manualAssign.get(d.subscriptionId);
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
        const stopMap = new Map(algorithmStops.map((d) => [d.subscriptionId, d]));
        stops = customOrder
          .map((id) => stopMap.get(id))
          .filter((d): d is typeof effectiveDeliveries[number] => d !== undefined);
        for (const d of algorithmStops) {
          if (!customOrder.includes(d.subscriptionId)) stops.push(d);
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

    // Use simple hex colors that work with canvas
    // The oklch format in CSS variables isn't supported by canvas API
    const isDark = document.documentElement.classList.contains("dark");
    const bgColor = isDark ? "#1e293b" : "#ffffff";

    const dataUrl = await toPng(tableRef.current, {
      backgroundColor: bgColor,
      pixelRatio: 2,
    });

    const response = await fetch(dataUrl);
    return await response.blob();
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

  const [copiedText, setCopiedText] = useState(false);
  const handleCopyText = () => {
    const lines: string[] = [];

    // Group sortedRows by shipper index
    const shipperGroups = new Map<number, typeof sortedRows>();
    for (const row of sortedRows) {
      if (row.shipper === null) continue;
      const group = shipperGroups.get(row.shipper) ?? [];
      group.push(row);
      shipperGroups.set(row.shipper, group);
    }

    for (const [shipperIdx, rows] of [...shipperGroups.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push(`--- Shipper ${shipperIdx + 1} (${rows.length} stop${rows.length !== 1 ? "s" : ""}) ---`);
      for (const row of rows) {
        const d = row.delivery;
        const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
        const permanentNote = permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
        lines.push(`${row.stop}. ${d.name}`);
        lines.push(`   Phone: ${d.phone}`);
        lines.push(`   Address: ${d.address}`);
        if (d.meals.length > 0) lines.push(`   Meals: ${d.meals.join(", ")}`);
        if (permanentNote) lines.push(`   Note: ${permanentNote}`);
        if (note) lines.push(`   Today: ${note}`);
      }
      lines.push("");
    }

    if (withoutCoords.length > 0) {
      lines.push(`--- No route (${withoutCoords.length} stop${withoutCoords.length !== 1 ? "s" : ""}) ---`);
      withoutCoords.forEach((d, i) => {
        const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
        const permanentNote = permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
        lines.push(`${i + 1}. ${d.name}`);
        lines.push(`   Phone: ${d.phone}`);
        lines.push(`   Address: ${d.address}`);
        if (d.meals.length > 0) lines.push(`   Meals: ${d.meals.join(", ")}`);
        if (permanentNote) lines.push(`   Note: ${permanentNote}`);
        if (note) lines.push(`   Today: ${note}`);
      });
    }

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const [copiedMenu, setCopiedMenu] = useState(false);
  const handleCopyMenu = () => {
    const lines: string[] = [];

    const optionAName = menuOptionA ?? "Option A";
    const optionBName = menuOptionB ?? "Option B";
    const firstWord = (s: string) => s.split(/\s+/)[0];
    const shortAddr = (s: string) => s.split(",")[0].trim();

    // Overall meal summary
    const allDeliveries = [...sortedRows.map((r) => r.delivery), ...withoutCoords];
    let countA = 0, countB = 0;
    for (const d of allDeliveries) {
      for (const slot of d.mealSlots) {
        if (slot === 1) countA++;
        else if (slot === 2) countB++;
      }
    }
    lines.push(`${optionAName}: ${countA} portions`);
    lines.push(`${optionBName}: ${countB} portions`);
    lines.push(`Total: ${countA + countB} meals`);
    lines.push("");

    // Group sortedRows by shipper
    const shipperGroups = new Map<number, typeof sortedRows>();
    for (const row of sortedRows) {
      if (row.shipper === null) continue;
      const group = shipperGroups.get(row.shipper) ?? [];
      group.push(row);
      shipperGroups.set(row.shipper, group);
    }

    const getNote = (d: typeof allDeliveries[number]) =>
      notes.find((n) => n.customerId === d.phone)?.note ?? null;
    const getPermNote = (d: typeof allDeliveries[number]) =>
      permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
    const hasNote = (d: typeof allDeliveries[number]) => !!(getNote(d) || getPermNote(d));

    // First pass: emit all rows, track global number per customerId
    const globalNumMap = new Map<string, number>();
    let globalNum = 1;

    const emitRow = (d: typeof allDeliveries[number], stopLabel: string) => {
      const note = getNote(d);
      const permanentNote = getPermNote(d);
      const mealStr = d.meals.length > 0 ? d.meals.map(firstWord).join(" + ") : "—";
      const parts = [mealStr];
      if (permanentNote) parts.push(permanentNote);
      if (note) parts.push(note);
      parts.push(shortAddr(d.address));
      const n = globalNum++;
      globalNumMap.set(d.subscriptionId, n);
      lines.push(`${n} | ${stopLabel}. ${d.name} | ${parts.join(" | ")}`);
    };

    for (const [shipperIdx, rows] of [...shipperGroups.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push(`--- Shipper ${shipperIdx + 1} (${rows.length} stop${rows.length !== 1 ? "s" : ""}) ---`);
      for (const row of rows) emitRow(row.delivery, String(row.stop));
      lines.push("");
    }

    if (withoutCoords.length > 0) {
      lines.push(`--- No route (${withoutCoords.length} stop${withoutCoords.length !== 1 ? "s" : ""}) ---`);
      withoutCoords.forEach((d, i) => emitRow(d, String(i + 1)));
      lines.push("");
    }

    // Bottom section 1: no-notes meal summary (1 line)
    let noNotesA = 0, noNotesB = 0;
    for (const d of allDeliveries) {
      if (hasNote(d)) continue;
      for (const slot of d.mealSlots) {
        if (slot === 1) noNotesA++;
        else if (slot === 2) noNotesB++;
      }
    }
    lines.push(`No notes: ${optionAName} ×${noNotesA}  |  ${optionBName} ×${noNotesB}  |  Total: ${noNotesA + noNotesB} meals`);
    lines.push("");

    // Bottom section 2: with-notes customers flat list, original global numbers
    const notedDeliveries = allDeliveries.filter(hasNote);
    if (notedDeliveries.length > 0) {
      lines.push("--- With notes ---");
      for (const d of notedDeliveries) {
        const note = getNote(d);
        const permanentNote = getPermNote(d);
        const mealStr = d.meals.length > 0 ? d.meals.map(firstWord).join(" + ") : "—";
        const parts = [mealStr];
        if (permanentNote) parts.push(permanentNote);
        if (note) parts.push(note);
        parts.push(shortAddr(d.address));
        lines.push(`${globalNumMap.get(d.subscriptionId)}. ${d.name} | ${parts.join(" | ")}`);
      }
    }

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedMenu(true);
    setTimeout(() => setCopiedMenu(false), 2000);
  };

  const [copyingMenuPng, setCopyingMenuPng] = useState(false);

  const captureMenuPng = async (): Promise<Blob> => {
    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#0f172a" : "#ffffff";
    const fg = isDark ? "#f8fafc" : "#0f172a";
    const muted = isDark ? "#cbd5e1" : "#374151";
    const rowAlt = isDark ? "#1e293b" : "#f1f5f9";
    const noteBg = isDark ? "#422006" : "#fef3c7";
    const noteFg = isDark ? "#fde68a" : "#92400e";
    const sectionBorder = isDark ? "#334155" : "#e2e8f0";

    const optionAName = menuOptionA ?? "Option A";
    const optionBName = menuOptionB ?? "Option B";
    const fw = (s: string) => s.split(/\s+/)[0];
    const sa = (s: string) => s.split(",")[0].trim();
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const allDels = [...sortedRows.map((r) => r.delivery), ...withoutCoords];
    const gNote = (d: typeof allDels[number]) => notes.find((n) => n.customerId === d.phone)?.note ?? null;
    const gPerm = (d: typeof allDels[number]) => permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
    const hNote = (d: typeof allDels[number]) => !!(gNote(d) || gPerm(d));

    let cA = 0, cB = 0;
    for (const d of allDels) for (const s of d.mealSlots) { if (s === 1) cA++; else if (s === 2) cB++; }

    const sgLocal = new Map<number, typeof sortedRows>();
    for (const row of sortedRows) {
      if (row.shipper === null) continue;
      const g = sgLocal.get(row.shipper) ?? []; g.push(row); sgLocal.set(row.shipper, g);
    }
    const sortedSh = [...sgLocal.entries()].sort((a, b) => a[0] - b[0]);

    const gnMap = new Map<string, number>();
    let gn = 1;
    for (const [, rows] of sortedSh) for (const r of rows) gnMap.set(r.delivery.subscriptionId, gn++);
    for (const d of withoutCoords) gnMap.set(d.subscriptionId, gn++);

    let noA = 0, noB = 0;
    for (const d of allDels) {
      if (hNote(d)) continue;
      for (const s of d.mealSlots) { if (s === 1) noA++; else if (s === 2) noB++; }
    }
    const noted = allDels.filter(hNote);

    const mkRow = (d: typeof allDels[number], stopLabel: string, idx: number) => {
      const note = gNote(d); const perm = gPerm(d); const hasN = !!(note || perm);
      const meal = d.meals.length > 0 ? d.meals.map(fw).join(" + ") : "—";
      const noteStr = ([perm, note] as (string | null)[]).filter((s): s is string => s !== null).map(esc).join(" · ");
      const rowBg = hasN ? noteBg : (idx % 2 === 0 ? rowAlt : bg);
      return `<tr style="background:${rowBg}">
        <td style="padding:4px 6px;color:${fg};font-size:13px;font-weight:700;text-align:right;white-space:nowrap;width:28px">${gnMap.get(d.subscriptionId)}</td>
        <td style="padding:4px 5px;color:${muted};font-size:13px;font-weight:700;text-align:right;width:22px">${esc(stopLabel)}</td>
        <td style="padding:4px 8px;font-weight:700;white-space:nowrap;color:${fg}">${esc(d.name)}</td>
        <td style="padding:4px 8px;color:#4f46e5;font-weight:700;white-space:nowrap">${esc(meal)}</td>
        <td style="padding:4px 8px;color:${hasN ? noteFg : muted};font-size:13px;font-weight:600;max-width:180px">${noteStr || ""}</td>
        <td style="padding:4px 8px;color:${muted};font-size:13px;font-weight:600">${esc(sa(d.address))}</td>
      </tr>`;
    };

    let shipperHtml = "";
    for (const [si, rows] of sortedSh) {
      const color = CLUSTER_COLORS[si % CLUSTER_COLORS.length];
      const rowsHtml = rows.map((r, i) => mkRow(r.delivery, String(r.stop), i)).join("");
      shipperHtml += `<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:${color}33;border-left:5px solid ${color};border-radius:0 6px 6px 0;margin-bottom:4px">
          <span style="color:${color};font-weight:800;font-size:14px">Shipper ${si + 1}</span>
          <span style="color:${fg};font-size:13px;font-weight:700">${rows.length} stop${rows.length !== 1 ? "s" : ""}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:${fg}">${rowsHtml}</table>
      </div>`;
    }
    if (withoutCoords.length > 0) {
      const rowsHtml = withoutCoords.map((d, i) => mkRow(d, String(i + 1), i)).join("");
      shipperHtml += `<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:${sectionBorder};border-left:5px solid ${muted};border-radius:0 6px 6px 0;margin-bottom:4px">
          <span style="color:${fg};font-weight:800;font-size:14px">No route</span>
          <span style="color:${fg};font-size:13px;font-weight:700">${withoutCoords.length} stop${withoutCoords.length !== 1 ? "s" : ""}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:${fg}">${rowsHtml}</table>
      </div>`;
    }

    let notedHtml = "";
    if (noted.length > 0) {
      const noteRows = noted.map((d, i) => {
        const note = gNote(d); const perm = gPerm(d);
        const meal = d.meals.length > 0 ? d.meals.map(fw).join(" + ") : "—";
        const noteStr = ([perm, note] as (string | null)[]).filter((s): s is string => s !== null).map(esc).join(" · ");
        return `<tr style="background:${i % 2 === 0 ? noteBg : bg}">
          <td style="padding:4px 6px;color:${fg};font-size:13px;font-weight:700;text-align:right;width:28px">${gnMap.get(d.subscriptionId)}</td>
          <td style="padding:4px 8px;font-weight:700;white-space:nowrap;color:${fg}">${esc(d.name)}</td>
          <td style="padding:4px 8px;color:#4f46e5;font-weight:700;white-space:nowrap">${esc(meal)}</td>
          <td style="padding:4px 8px;color:${noteFg};font-size:13px;font-weight:700">${noteStr}</td>
          <td style="padding:4px 8px;color:${muted};font-size:13px;font-weight:600">${esc(sa(d.address))}</td>
        </tr>`;
      }).join("");
      notedHtml = `<div style="margin-top:16px;padding-top:12px;border-top:2px solid ${sectionBorder}">
        <div style="font-weight:800;font-size:14px;margin-bottom:6px;color:${fg}">With notes</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:${fg}">${noteRows}</table>
      </div>`;
    }

    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;width:740px;padding:24px;background:${bg};color:${fg}">
      <div style="margin-bottom:18px">
        <div style="font-size:16px;font-weight:800;margin-bottom:10px;color:${fg}">Menu Report · ${esc(date)}</div>
        <div style="display:flex;gap:10px">
          <div style="background:#6366f1;color:white;padding:10px 18px;border-radius:8px;min-width:130px">
            <div style="font-size:10px;opacity:0.75;margin-bottom:2px">${esc(optionAName)}</div>
            <div style="font-size:28px;font-weight:800;line-height:1">${cA}</div>
          </div>
          <div style="background:#22c55e;color:white;padding:10px 18px;border-radius:8px;min-width:130px">
            <div style="font-size:10px;opacity:0.75;margin-bottom:2px">${esc(optionBName)}</div>
            <div style="font-size:28px;font-weight:800;line-height:1">${cB}</div>
          </div>
          <div style="background:${isDark ? "#1e293b" : "#0f172a"};color:white;padding:10px 18px;border-radius:8px;min-width:110px">
            <div style="font-size:10px;opacity:0.75;margin-bottom:2px">Total meals</div>
            <div style="font-size:28px;font-weight:800;line-height:1">${cA + cB}</div>
          </div>
        </div>
      </div>
      ${shipperHtml}
      <div style="padding:7px 12px;background:${rowAlt};border-radius:6px;font-size:13px;font-weight:700;color:${fg};border:1px solid ${sectionBorder}">
        No notes: &nbsp;${esc(optionAName)} ×${noA}&nbsp; | &nbsp;${esc(optionBName)} ×${noB}&nbsp; | &nbsp;Total: ${noA + noB} meals
      </div>
      ${notedHtml}
    </div>`;

    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;left:-9999px;top:0;z-index:-1";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(wrap.firstElementChild as HTMLElement, { backgroundColor: bg, pixelRatio: 2 });
      const res = await fetch(dataUrl);
      return await res.blob();
    } finally {
      document.body.removeChild(wrap);
    }
  };

  const handleCopyMenuPng = async () => {
    setCopyingMenuPng(true);
    try {
      const blobPromise = captureMenuPng();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    } catch (e) {
      console.error("Copy menu PNG failed:", e);
    } finally {
      setCopyingMenuPng(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="px-3 pt-2 flex items-center gap-3 text-xs flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <span className="text-muted-foreground">Shippers:</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, withCoords.length)}
            value={manualK ?? cluster.k}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 1) { setManualK(v); localStorage.setItem("route_manual_k", String(v)); }
            }}
            className="h-7 w-16 px-2 border rounded text-sm"
          />
          {manualK !== null && (
            <button
              type="button"
              onClick={() => { setManualK(null); localStorage.removeItem("route_manual_k"); }}
              className="h-7 px-2 text-xs rounded border bg-background hover:bg-accent"
              title="Use auto"
            >
              Auto
            </button>
          )}
        </label>
        <span className="text-muted-foreground shrink-0">
          {cluster.k > 0 ? `${cluster.k} shipper${cluster.k > 1 ? "s" : ""} planned` : "no route planned"}
        </span>
        <div className="flex gap-1 ml-auto flex-wrap">
          <button
            type="button"
            onClick={handleExportPNG}
            className="h-7 px-3 text-xs rounded border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
            title="Download shipping table as PNG"
          >
            Export PNG
          </button>
          <button
            type="button"
            onClick={handleCopyPNG}
            disabled={copying}
            className="h-7 px-3 text-xs rounded border bg-background hover:bg-accent transition-colors disabled:opacity-50 shrink-0"
            title="Copy shipping table PNG to clipboard"
          >
            {copying ? "Copying…" : "Copy PNG"}
          </button>
          <button
            type="button"
            onClick={handleCopyText}
            className="h-7 px-3 text-xs rounded border bg-background hover:bg-accent transition-colors shrink-0"
            title="Copy shipping details as text, grouped by shipper"
          >
            {copiedText ? "Copied!" : "Copy Text"}
          </button>
          <button
            type="button"
            onClick={handleCopyMenu}
            className="h-7 px-3 text-xs rounded border bg-background hover:bg-accent transition-colors shrink-0"
            title="Copy menu summary and per-customer info grouped by shipper"
          >
            {copiedMenu ? "Copied!" : "Menu"}
          </button>
          <button
            type="button"
            onClick={handleCopyMenuPng}
            disabled={copyingMenuPng}
            className="h-7 px-3 text-xs font-bold rounded border bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shrink-0"
            title="Copy menu report as PNG to clipboard"
          >
            {copyingMenuPng ? "Copying…" : "Menu PNG"}
          </button>
        </div>
      </div>

       <div className="overflow-x-auto px-3 pb-3" ref={tableRef}>
         <table className="w-full min-w-[1080px] table-fixed text-sm">
           <thead>
             <tr className="border-b bg-muted/50">
               <th className="w-10 px-3 py-2 text-left font-medium">#</th>
               <th className="w-20 px-3 py-2 text-left font-medium">Shipper</th>
               <th className="w-[220px] px-3 py-2 text-left font-medium">Customer</th>
               <th className="w-[220px] px-3 py-2 text-left font-medium">Notes</th>
               <th className="w-[260px] px-3 py-2 text-left font-medium">Today&apos;s Meals</th>
               <th className="w-[350px] px-3 py-2 text-left font-medium">Address</th>
             </tr>
           </thead>
           <tbody className="divide-y">
             {deliveries.length === 0 && (
               <tr>
                 <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
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
                <tr key={d.subscriptionId} className="align-top hover:bg-accent/50 transition-colors">
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2 align-top">
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
                  <td className="px-3 py-2 align-top">
                    <CustomerCell
                      customerId={d.customerId}
                      name={d.name}
                      phone={d.phone}
                      address={d.address}
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NotesCell permanentNote={permanentNote} note={note} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <MealsCell meals={d.meals} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <AddressCell
                      delivery={d}
                      selectedId={selectedAddressIds.get(d.subscriptionId) ?? d.defaultAddressId}
                      onChange={(id) => setSelectedAddressIds((prev) => new Map(prev).set(d.subscriptionId, id))}
                    />
                  </td>
                </tr>
              );
            })}
            {/* Deliveries without coordinates appear at bottom unsorted */}
            {cluster.k > 0 && withoutCoords.map((d) => {
              const note = notes.find((n) => n.customerId === d.phone)?.note ?? null;
              const permanentNote = permanentNotes.find((n) => n.customerId === d.customerId)?.note ?? null;
              return (
                <tr key={d.subscriptionId} className="align-top bg-amber-50/30 hover:bg-accent/50 transition-colors">
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">—</td>
                  <td className="px-3 py-2 align-top">
                    <span className="text-[10px] text-amber-700" title="No coordinates set">no coord</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <CustomerCell
                      customerId={d.customerId}
                      name={d.name}
                      phone={d.phone}
                      address={d.address}
                      copiedKey={copiedKey}
                      onCopy={copyToClipboard}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <NotesCell permanentNote={permanentNote} note={note} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <MealsCell meals={d.meals} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <AddressCell
                      delivery={d}
                      selectedId={selectedAddressIds.get(d.subscriptionId) ?? d.defaultAddressId}
                      onChange={(id) => setSelectedAddressIds((prev) => new Map(prev).set(d.subscriptionId, id))}
                    />
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
  const [persisting, startPersist] = useTransition();

  if (addresses.length <= 1) {
    return <span className="block text-xs leading-snug break-words">{delivery.address}</span>;
  }

  const selected = addresses.find((a) => a.id === selectedId) ?? addresses.find((a) => a.isDefault) ?? addresses[0];

  function handleChange(id: string) {
    onChange(id);
    startPersist(async () => {
      try {
        if (!id) {
          await deleteDayAddressAction(delivery.subscriptionId, delivery.weekLabel, delivery.day);
        } else {
          await upsertDayAddressAction(delivery.subscriptionId, delivery.weekLabel, delivery.day, id);
        }
      } catch (error) {
        console.error("Failed to update day address:", error);
        // Revert optimistic update on error
        onChange(selectedId ?? "");
      }
    });
  }

  return (
    <div className="space-y-1.5">
      {addresses.map((address) => {
        const isSelected = address.id === selected?.id;
        return (
          <button
            key={address.id}
            type="button"
            onClick={() => handleChange(address.id)}
            disabled={persisting}
            className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
              isSelected
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : "border-border bg-background hover:bg-accent"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {address.label || "Address"}
                {address.isDefault && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">(default)</span>
                )}
              </span>
              {isSelected && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Selected
                </span>
              )}
            </span>
            <span className="mt-1 block leading-snug text-muted-foreground break-words">
              {address.address}
            </span>
            {address.zone && (
              <span className="mt-1 block text-[10px] text-muted-foreground/70">
                {address.zone}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
