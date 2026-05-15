"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDarkMode } from "@/lib/utils/use-dark-mode";
import {
  depotAwareClusters,
  fixedKClusters,
  clustersFromAssignments,
  haversineDistance,
  routeTimeMin,
  CLUSTER_COLORS,
  DEFAULT_CONSTRAINTS,
  type Constraints,
  type ClusterResult,
} from "./clustering";

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diffMs = d.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

type Delivery = {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  meals?: string[];
  permanentNote?: string | null;
  dateNote?: string | null;
};

type RouteMapProps = {
  deliveries: Delivery[];
  date: string;
  hubLat: number;
  hubLng: number;
};

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

// Web Mercator helpers for tile compositing
function mercY(latDeg: number): number {
  const r = (latDeg * Math.PI) / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
}

function latLngToWorldPx(lat: number, lng: number, z: number): [number, number] {
  const n = Math.pow(2, z) * 256;
  return [((lng + 180) / 360) * n, mercY(lat) * n];
}

function chooseTileZoom(
  minLat: number, maxLat: number, minLng: number, maxLng: number,
  mapPxW: number, mapPxH: number
): number {
  const lngSpan = Math.max(maxLng - minLng, 0.001);
  const zW = Math.log2((mapPxW / 256) * (360 / lngSpan));
  const mercSpan = Math.max(mercY(minLat) - mercY(maxLat), 0.00001);
  const zH = Math.log2(mapPxH / 256 / mercSpan);
  return Math.max(1, Math.min(16, Math.floor(Math.min(zW, zH))));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`tile load failed: ${url}`));
    img.src = url;
  });
}

async function fetchRoadGeometry(waypoints: { lat: number; lng: number }[], abortSignal?: AbortSignal): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;
  try {
    const res = await fetch("/api/route-geometry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints }),
      signal: abortSignal ?? AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[Route] API failed:", res.status, data);
      return null;
    }
    const data = await res.json();
    return data.positions ?? null;
  } catch (e) {
    console.warn("[Route] API fetch error:", e);
    return null;
  }
}

const DEFAULT_PRICE_PER_KM = 5000;

export function RouteMap({ deliveries, date, hubLat, hubLng }: RouteMapProps) {
  // Wrapped in an object so React doesn't treat the component fn as a state updater
  const [mapModule, setMapModule] = useState<{ Component: React.ComponentType<any> } | null>(null);
  const MapComponent = mapModule?.Component ?? null;
  const dark = useDarkMode();
  const [routeGeometries, setRouteGeometries] = useState<([number, number][] | null)[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [geometryFailed, setGeometryFailed] = useState(false);

  const [hubInput, setHubInput] = useState(`${hubLat}, ${hubLng}`);
  const [hubAddress, setHubAddress] = useState("Hub");
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [pricePerKm, setPricePerKm] = useState<number>(DEFAULT_PRICE_PER_KM);
  const [hydrated, setHydrated] = useState(false);

  const [manualK, setManualK] = useState<number | null>(null);
  const [manualAssign, setManualAssign] = useState<Map<string, number>>(new Map());
  const [manualOrder, setManualOrder] = useState<Map<number, string[]>>(new Map());

  const weekLabel = useMemo(() => getWeekLabel(date), [date]);

  const zoomToFitRef = useRef<(() => void) | null>(null);
  // Tracks the hub+k state recorded after the first post-hydration render so we
  // can distinguish "loaded from localStorage" from "user explicitly changed".
  const hydratedHubRef = useRef<{ lat: number; lng: number; k: number | null } | null>(null);

  // Load persisted settings after mount to avoid SSR/CSR hydration mismatch
  useEffect(() => {
    // Always prefer the server-side hub from Settings (hubLat/hubLng props).
    // The localStorage "route_hub" is only used when the user manually types
    // a custom hub on the route page — treat it as an override only if it
    // matches the server value (i.e. came from a previous save of the same hub).
    // If they differ, the Settings hub wins (user updated it).
    const serverHub = `${hubLat}, ${hubLng}`;
    const savedHub = localStorage.getItem("route_hub");
    if (savedHub && savedHub !== serverHub) {
      // User had a custom hub typed on this page; keep it only if it doesn't
      // look like an old server hub (heuristic: just always trust server value
      // so Settings changes are reflected immediately).
      setHubInput(serverHub);
      localStorage.setItem("route_hub", serverHub);
    } else if (savedHub) {
      setHubInput(savedHub);
    }
    const savedAddr = localStorage.getItem("route_hub_address");
    if (savedAddr) setHubAddress(savedAddr);
    const savedConstraints = localStorage.getItem("route_constraints");
    if (savedConstraints) {
      try { setConstraints(JSON.parse(savedConstraints)); } catch { /* ignore */ }
    }
    const savedPrice = localStorage.getItem("route_price_per_km");
    if (savedPrice) setPricePerKm(parseFloat(savedPrice) || DEFAULT_PRICE_PER_KM);
    const savedK = localStorage.getItem("route_manual_k");
    if (savedK) { const k = parseInt(savedK, 10); if (!isNaN(k) && k >= 1) setManualK(k); }

    // Restore manual overrides for this week
    try {
      const savedOverrides = localStorage.getItem(`route-overrides-${date}`);
      if (savedOverrides) {
        const overrides = JSON.parse(savedOverrides) as Record<string, number>;
        setManualAssign(new Map(Object.entries(overrides)));
      }
      const savedOrder = localStorage.getItem(`route_order_${date}`);
      if (savedOrder) setManualOrder(new Map(JSON.parse(savedOrder) as [number, string[]][]));
    } catch { /* ignore */ }

    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hub = useMemo(() => {
    const m = hubInput.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (!m) return { lat: hubLat, lng: hubLng, address: hubAddress };
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), address: hubAddress };
  }, [hubInput, hubAddress, hubLat, hubLng]);

  const saveHub = useCallback(() => {
    localStorage.setItem("route_hub", hubInput);
    localStorage.setItem("route_hub_address", hubAddress);
  }, [hubInput, hubAddress]);

  const saveConstraints = useCallback((c: Constraints) => {
    setConstraints(c);
    localStorage.setItem("route_constraints", JSON.stringify(c));
  }, []);

  const savePricePerKm = useCallback((v: number) => {
    setPricePerKm(v);
    localStorage.setItem("route_price_per_km", String(v));
  }, []);

  // Auto recommendation (always computed)
  const autoResult: ClusterResult = useMemo(() => {
    if (deliveries.length === 0) return { assignments: [], routes: [], distances: [], k: 0 };
    const points = deliveries.map((d) => ({ lat: d.lat, lng: d.lng }));
    return depotAwareClusters(points, hub, constraints);
  }, [deliveries, hub, constraints]);

  const recommendedK = autoResult.k;

  // Reset manual overrides only when the user explicitly changes the hub or
  // shipper count AFTER the initial load. We skip the first post-hydration run
  // (which fires because hubInput and hub coords settle from localStorage) to
  // avoid clearing the overrides that were just restored.
  useEffect(() => {
    if (!hydrated) return;
    const snapshot = { lat: hub.lat, lng: hub.lng, k: manualK };
    if (hydratedHubRef.current === null) {
      // First run after hydration — record the loaded state as the baseline.
      hydratedHubRef.current = snapshot;
      return;
    }
    const prev = hydratedHubRef.current;
    if (prev.lat === snapshot.lat && prev.lng === snapshot.lng && prev.k === snapshot.k) return;
    hydratedHubRef.current = snapshot;
    setManualAssign(new Map());
    setManualOrder(new Map());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub.lat, hub.lng, manualK, hydrated]);

  // Final clusters (auto / fixed-k / with manual overrides)
  const clusterResult: ClusterResult = useMemo(() => {
    if (deliveries.length === 0) return { assignments: [], routes: [], distances: [], k: 0 };
    const points = deliveries.map((d) => ({ lat: d.lat, lng: d.lng }));

    let base: number[];
    if (manualK !== null && manualK !== recommendedK) {
      base = fixedKClusters(points, hub, manualK).assignments;
    } else {
      base = autoResult.assignments;
    }

    if (manualAssign.size > 0) {
      base = base.slice();
      deliveries.forEach((d, i) => {
        const override = manualAssign.get(d.id);
        if (override !== undefined) base[i] = override;
      });
    }

    return clustersFromAssignments(points, hub, base);
  }, [deliveries, hub, autoResult, manualK, manualAssign, recommendedK]);

  // Persist manual overrides for this date
  useEffect(() => {
    if (!hydrated) return;
    if (manualAssign.size > 0) {
      const obj: Record<string, number> = {};
      manualAssign.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(`route-overrides-${date}`, JSON.stringify(obj));
    } else {
      localStorage.removeItem(`route-overrides-${date}`);
    }
  }, [manualAssign, date, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (manualOrder.size > 0) {
      localStorage.setItem(`route_order_${date}`, JSON.stringify([...manualOrder.entries()]));
    } else {
      localStorage.removeItem(`route_order_${date}`);
    }
  }, [manualOrder, date, hydrated]);

  // Per-cluster ordered deliveries with hub prepended; applies manual ordering overrides.
  // Skips empty slots (can occur when manualAssign leaves a cluster empty after stable-ID preservation).
  const clusterData = useMemo(() => {
    const hubDelivery: Delivery = { id: "__hub__", name: "Hub", phone: "", address: hub.address, lat: hub.lat, lng: hub.lng };
    return clusterResult.routes
      .map((routeIndices, ci) => {
        if (routeIndices.length === 0) return null;
        const algorithmStops = routeIndices.map((i) => deliveries[i]);
        const customOrder = manualOrder.get(ci);

        let stops: Delivery[];
        if (customOrder) {
          const stopMap = new Map(algorithmStops.map((d) => [d.id, d]));
          stops = customOrder.map((id) => stopMap.get(id)).filter((d): d is Delivery => d !== undefined);
          for (const d of algorithmStops) {
            if (!customOrder.includes(d.id)) stops.push(d);
          }
        } else {
          stops = algorithmStops;
        }

        const ordered = [hubDelivery, ...stops];
        const stats: { distKm: number; cumDist: number }[] = [];
        let cumDist = 0;
        for (let i = 0; i < ordered.length; i++) {
          if (i === 0) {
            stats.push({ distKm: 0, cumDist: 0 });
          } else {
            const d = haversineDistance(ordered[i - 1], ordered[i]);
            cumDist += d;
            stats.push({ distKm: d, cumDist });
          }
        }
        const totalDist = cumDist;
        const totalTime = routeTimeMin(totalDist, stops.length, constraints);
        const totalPrice = totalDist * pricePerKm;
        return { ordered, stats, totalDist, totalTime, totalPrice, color: CLUSTER_COLORS[ci % CLUSTER_COLORS.length], slotIdx: ci };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [clusterResult, deliveries, hub, constraints, pricePerKm, manualOrder]);

  // Fetch road geometries — AbortController cancels stale in-flight requests when clusterData changes
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    if (clusterData.length === 0) { setRouteGeometries([]); return; }
    const controller = new AbortController();
    setIsCalculating(true);
    setGeometryFailed(false);
    Promise.all(
      clusterData.map((c) =>
        c.ordered.length >= 2
          ? fetchRoadGeometry(c.ordered, controller.signal)
          : Promise.resolve(null)
      )
    ).then((geoms) => {
      if (controller.signal.aborted) return;
      setRouteGeometries(geoms);
      setIsCalculating(false);
      setGeometryFailed(geoms.every((g) => g === null));
    });
    return () => controller.abort();
  }, [clusterData, retryCount]);

  // Dynamic Leaflet load
  useEffect(() => {
    import("./leaflet-map").then((mod) => setMapModule({ Component: mod.LeafletMap as React.ComponentType<any> }));
  }, []);

  const totalDistance = clusterData.reduce((s, c) => s + c.totalDist, 0);
  const totalPrice = totalDistance * pricePerKm;
  const totalStops = deliveries.length;
  const maxTime = Math.max(0, ...clusterData.map((c) => c.totalTime));
  const avgTime = clusterData.reduce((s, c) => s + c.totalTime, 0) / Math.max(1, clusterData.length);

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => setDraggingId(null);
  const handleDropOnCluster = (targetIdx: number) => {
    if (!draggingId) return;
    // Find the source cluster so we can re-optimise only the two affected shippers.
    let sourceIdx: number | null = null;
    for (const cluster of clusterData) {
      if (cluster.ordered.slice(1).some((d) => d.id === draggingId)) {
        sourceIdx = cluster.slotIdx;
        break;
      }
    }
    setManualAssign((prev) => {
      const next = new Map(prev);
      next.set(draggingId, targetIdx);
      return next;
    });
    // Clear manual order only for source + target so they pick up the freshly
    // TSP-optimised routes from clusterResult; other shippers keep their orders.
    setManualOrder((prev) => {
      const next = new Map(prev);
      next.delete(targetIdx);
      if (sourceIdx !== null) next.delete(sourceIdx);
      return next;
    });
    setDraggingId(null);
  };

  const handleReassign = (deliveryId: string, targetIdx: number) => {
    let sourceIdx: number | null = null;
    for (const cluster of clusterData) {
      if (cluster.ordered.slice(1).some((d) => d.id === deliveryId)) {
        sourceIdx = cluster.slotIdx;
        break;
      }
    }
    setManualAssign((prev) => {
      const next = new Map(prev);
      next.set(deliveryId, targetIdx);
      return next;
    });
    setManualOrder((prev) => {
      const next = new Map(prev);
      next.delete(targetIdx);
      if (sourceIdx !== null) next.delete(sourceIdx);
      return next;
    });
  };

  const handleReorder = (clusterIdx: number, newOrderIds: string[]) => {
    setManualOrder((prev) => {
      const next = new Map(prev);
      next.set(clusterIdx, newOrderIds);
      return next;
    });
  };

  const buildRouteCanvas = async (): Promise<HTMLCanvasElement> => {
    const DETAIL_W = 400;
    const MAP_W = 720;
    const CANVAS_W = MAP_W + DETAIL_W;
    const DETAIL_X = MAP_W;
    const HEADER_H = 56;
    const PAD = 16;
    const SHIP_BANNER_H = 44;
    const MIN_SECTION_H = 280;
    const STOP_BASE_H = 60;

    function calcStopH(d: Delivery): number {
      let h = STOP_BASE_H;
      if (d.meals && d.meals.length > 0) h += 14;
      if (d.permanentNote) h += 14;
      if (d.dateNote) h += 14;
      return h;
    }

    const sectionHeights = clusterData.map((cluster) => {
      const stops = cluster.ordered.filter((d) => d.id !== "__hub__");
      const stopsH = stops.reduce((h, d) => h + calcStopH(d), 0);
      return Math.max(MIN_SECTION_H, SHIP_BANNER_H + stopsH + PAD * 2);
    });

    const CANVAS_H = HEADER_H + sectionHeights.reduce((a, b) => a + b, 0);

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;

    // Theme palette
    const T = dark
      ? {
          headerBg: "#0f172a",
          headerText: "#f1f5f9",
          headerMuted: "#94a3b8",
          sectionMapBg: "#1e293b",
          sectionDetailBg: "#1e293b",
          divider: "#334155",
          bannerSep: "#334155",
          stopSep: "#2d3f52",
          shipperText: "#f1f5f9",
          shipperMuted: "#64748b",
          stopName: "#f1f5f9",
          stopPhone: "#64748b",
          stopAddress: "#94a3b8",
          stopMeal: "#fbbf24",
          stopPermNote: "#93c5fd",
          stopDateNote: "#6ee7b7",
          markerBorder: "#1e293b",
          hubBg: "#f1f5f9",
          hubText: "#0f172a",
        }
      : {
          headerBg: "#0f172a",
          headerText: "#f8fafc",
          headerMuted: "#94a3b8",
          sectionMapBg: "#dde6f0",
          sectionDetailBg: "#ffffff",
          divider: "#cbd5e1",
          bannerSep: "#e2e8f0",
          stopSep: "#f1f5f9",
          shipperText: "#0f172a",
          shipperMuted: "#64748b",
          stopName: "#0f172a",
          stopPhone: "#64748b",
          stopAddress: "#475569",
          stopMeal: "#b45309",
          stopPermNote: "#1d4ed8",
          stopDateNote: "#0f766e",
          markerBorder: "#ffffff",
          hubBg: "#0f172a",
          hubText: "#ffffff",
        };

    // ── Overall header ──
    ctx.fillStyle = T.headerBg;
    ctx.fillRect(0, 0, CANVAS_W, HEADER_H);
    ctx.fillStyle = T.headerText;
    ctx.font = "bold 20px system-ui,sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`Delivery Route — ${date}`, PAD, HEADER_H / 2);
    ctx.fillStyle = T.headerMuted;
    ctx.font = "13px system-ui,sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(
      `${deliveries.length} stop${deliveries.length !== 1 ? "s" : ""} · ${totalDistance.toFixed(1)} km · ${clusterData.length} shipper${clusterData.length !== 1 ? "s" : ""}`,
      CANVAS_W - PAD,
      HEADER_H / 2
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    let sectionY = HEADER_H;

    for (let ci = 0; ci < clusterData.length; ci++) {
      const cluster = clusterData[ci];
      const secH = sectionHeights[ci];
      const stops = cluster.ordered.filter((d) => d.id !== "__hub__");

      // Section backgrounds
      ctx.fillStyle = T.sectionMapBg;
      ctx.fillRect(0, sectionY, MAP_W, secH);
      ctx.fillStyle = T.sectionDetailBg;
      ctx.fillRect(DETAIL_X, sectionY, DETAIL_W, secH);

      // ── Per-shipper map ──
      const shipperPts: { lat: number; lng: number }[] = [hub];
      stops.forEach((d) => shipperPts.push({ lat: d.lat, lng: d.lng }));
      const geom = routeGeometries[ci] ?? null;
      if (geom) geom.forEach(([lat, lng]) => shipperPts.push({ lat, lng }));

      const lats = shipperPts.map((p) => p.lat);
      const lngs = shipperPts.map((p) => p.lng);
      const rawMinLat = Math.min(...lats), rawMaxLat = Math.max(...lats);
      const rawMinLng = Math.min(...lngs), rawMaxLng = Math.max(...lngs);
      const latSpan = Math.max(rawMaxLat - rawMinLat, 0.006);
      const lngSpan = Math.max(rawMaxLng - rawMinLng, 0.006);
      const minLat = rawMinLat - latSpan * 0.01, maxLat = rawMaxLat + latSpan * 0.01;
      const minLng = rawMinLng - lngSpan * 0.01, maxLng = rawMaxLng + lngSpan * 0.01;

      const mapH = secH;
      const z = chooseTileZoom(minLat, maxLat, minLng, maxLng, MAP_W, mapH);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const [cwx, cwy] = latLngToWorldPx(centerLat, centerLng, z);
      const scx = MAP_W / 2;
      const scy = sectionY + mapH / 2;

      const toXY = (lat: number, lng: number): [number, number] => {
        const [wx, wy] = latLngToWorldPx(lat, lng, z);
        return [scx + (wx - cwx), scy + (wy - cwy)];
      };

      const txMin = Math.floor((cwx - MAP_W / 2) / 256);
      const tyMin = Math.floor((cwy - mapH / 2) / 256);
      const txMax = Math.floor((cwx + MAP_W / 2) / 256);
      const tyMax = Math.floor((cwy + mapH / 2) / 256);
      const maxTileIdx = Math.pow(2, z) - 1;

      const tilePromises: Promise<{ tx: number; ty: number; img: HTMLImageElement } | null>[] = [];
      for (let tx = txMin; tx <= txMax; tx++) {
        for (let ty = tyMin; ty <= tyMax; ty++) {
          if (tx < 0 || ty < 0 || tx > maxTileIdx || ty > maxTileIdx) continue;
          const url = dark
            ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/${z}/${tx}/${ty}.png`
            : `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
          tilePromises.push(loadImage(url).then((img) => ({ tx, ty, img })).catch(() => null));
        }
      }
      const tiles = await Promise.all(tilePromises);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, sectionY, MAP_W, mapH);
      ctx.clip();

      tiles.forEach((t) => {
        if (!t) return;
        const sx = scx + (t.tx * 256 - cwx);
        const sy = scy + (t.ty * 256 - cwy);
        ctx.drawImage(t.img, sx, sy, 256, 256);
      });

      // This shipper's route
      ctx.strokeStyle = cluster.color;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash(geom ? [] : [8, 5]);
      ctx.beginPath();
      let started = false;
      const pts: [number, number][] = geom
        ? geom.map(([lat, lng]) => toXY(lat, lng))
        : cluster.ordered.map((d) => toXY(d.lat, d.lng));
      pts.forEach(([x, y]) => {
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Hub marker
      const [hx, hy] = toXY(hub.lat, hub.lng);
      ctx.fillStyle = T.hubBg;
      ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T.markerBorder; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = T.hubText;
      ctx.font = "bold 10px system-ui,sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("H", hx, hy);

      // Stop markers
      stops.forEach((d, idx) => {
        const [x, y] = toXY(d.lat, d.lng);
        ctx.fillStyle = cluster.color;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = T.markerBorder; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = T.hubText;
        ctx.font = `bold ${idx + 1 > 9 ? "9" : "10"}px system-ui,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), x, y);
      });

      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.restore();

      // Vertical divider (map | detail)
      ctx.strokeStyle = T.divider; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(MAP_W, sectionY); ctx.lineTo(MAP_W, sectionY + secH); ctx.stroke();

      // ── Detail panel ──
      let dy = sectionY + PAD;

      // Shipper banner
      ctx.fillStyle = cluster.color;
      ctx.fillRect(DETAIL_X + PAD - 2, dy, 4, 24);
      ctx.fillStyle = T.shipperText;
      ctx.font = "bold 15px system-ui,sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(`Shipper ${ci + 1}`, DETAIL_X + PAD + 10, dy + 12);
      ctx.fillStyle = T.shipperMuted;
      ctx.font = "12px system-ui,sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        `${cluster.totalDist.toFixed(1)} km · ${Math.ceil(cluster.totalTime)} min · ${Math.round(cluster.totalPrice).toLocaleString()} VND`,
        DETAIL_X + DETAIL_W - PAD, dy + 12
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      dy += SHIP_BANNER_H;

      // Banner separator
      ctx.strokeStyle = T.bannerSep; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(DETAIL_X + PAD, dy - 8); ctx.lineTo(DETAIL_X + DETAIL_W - PAD, dy - 8); ctx.stroke();

      // Stops
      stops.forEach((d, idx) => {
        ctx.fillStyle = cluster.color;
        ctx.beginPath(); ctx.arc(DETAIL_X + PAD + 8, dy + 10, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${idx + 1 > 9 ? "8" : "9"}px system-ui,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), DETAIL_X + PAD + 8, dy + 10);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

        const tx = DETAIL_X + PAD + 24;
        const maxTW = DETAIL_W - PAD * 2 - 24;

        ctx.fillStyle = T.stopName;
        ctx.font = "bold 13px system-ui,sans-serif";
        ctx.fillText(truncateText(ctx, d.name, maxTW), tx, dy + 14);

        ctx.fillStyle = T.stopPhone;
        ctx.font = "11px system-ui,sans-serif";
        ctx.fillText(d.phone, tx, dy + 27);

        ctx.fillStyle = T.stopAddress;
        ctx.font = "11px system-ui,sans-serif";
        ctx.fillText(truncateText(ctx, d.address, maxTW), tx, dy + 40);

        let rowY = dy + 54;

        if (d.meals && d.meals.length > 0) {
          ctx.fillStyle = T.stopMeal;
          ctx.font = "11px system-ui,sans-serif";
          ctx.fillText(truncateText(ctx, `Meal: ${d.meals.join(", ")}`, maxTW), tx, rowY);
          rowY += 14;
        }

        if (d.permanentNote) {
          ctx.fillStyle = T.stopPermNote;
          ctx.font = "italic 10px system-ui,sans-serif";
          ctx.fillText(truncateText(ctx, `Note: ${d.permanentNote}`, maxTW), tx, rowY);
          rowY += 14;
        }

        if (d.dateNote) {
          ctx.fillStyle = T.stopDateNote;
          ctx.font = "italic 10px system-ui,sans-serif";
          ctx.fillText(truncateText(ctx, `Today: ${d.dateNote}`, maxTW), tx, rowY);
          rowY += 14;
        }

        dy += calcStopH(d);

        if (idx < stops.length - 1) {
          ctx.strokeStyle = T.stopSep; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(DETAIL_X + PAD + 24, dy - 4); ctx.lineTo(DETAIL_X + DETAIL_W - PAD, dy - 4); ctx.stroke();
        }
      });

      // Section divider
      ctx.strokeStyle = T.divider; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, sectionY + secH); ctx.lineTo(CANVAS_W, sectionY + secH); ctx.stroke();

      sectionY += secH;
    }

    return canvas;
  };

  const handleExportPNG = async () => {
    const canvas = await buildRouteCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `route-${date}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const [copying, setCopying] = useState(false);
  const handleCopyPNG = async () => {
    setCopying(true);
    try {
      const blobPromise = buildRouteCanvas().then(
        (canvas) =>
          new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))));
          })
      );
      // Pass the Promise directly so ClipboardItem is created within the user gesture,
      // preventing the browser from blocking the write due to activation timeout.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    } catch (e) {
      console.error("Copy to clipboard failed:", e);
    } finally {
      setCopying(false);
    }
  };

  const toolbar = (
    <Card>
      <CardContent className="py-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Hub Name" className="min-w-[120px] flex-1">
            <Input value={hubAddress} onChange={(e) => setHubAddress(e.target.value)} onBlur={saveHub} className="h-8 text-sm" />
          </Field>
          <Field label="Hub (lat, lng)" className="min-w-[170px] flex-1">
            <Input value={hubInput} onChange={(e) => setHubInput(e.target.value)} onBlur={saveHub} className="h-8 text-sm font-mono" />
          </Field>
          <Field label="Speed km/h" className="w-20">
            <Input type="number" value={constraints.speedKmh}
              onChange={(e) => saveConstraints({ ...constraints, speedKmh: parseFloat(e.target.value) || 20 })}
              className="h-8 text-sm" />
          </Field>
          <Field label="Max time" className="w-20">
            <Input type="number" value={constraints.maxTimeMin}
              onChange={(e) => saveConstraints({ ...constraints, maxTimeMin: parseFloat(e.target.value) || 105 })}
              className="h-8 text-sm" />
          </Field>
          <Field label="Wait/stop" className="w-20">
            <Input type="number" value={constraints.waitPerStopMin}
              onChange={(e) => saveConstraints({ ...constraints, waitPerStopMin: parseFloat(e.target.value) || 7 })}
              className="h-8 text-sm" />
          </Field>
          <Field label="đ / km" className="w-24">
            <Input type="number" value={pricePerKm}
              onChange={(e) => savePricePerKm(parseFloat(e.target.value) || 0)}
              className="h-8 text-sm" />
          </Field>
          <Field
            label={manualK === null ? `Shippers (auto: ${recommendedK})` : `Shippers (rec: ${recommendedK})`}
            className="w-36"
          >
            <div className="flex gap-1">
              <Input
                type="number"
                min={1}
                max={Math.max(1, deliveries.length)}
                value={manualK ?? recommendedK}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1) { setManualK(v); localStorage.setItem("route_manual_k", String(v)); }
                }}
                className="h-8 text-sm"
              />
              {manualK !== null && (
                <button
                  type="button"
                  onClick={() => { setManualK(null); localStorage.removeItem("route_manual_k"); }}
                  className="h-8 px-2 text-xs rounded border bg-background hover:bg-accent shrink-0"
                  title="Use recommended"
                >
                  Auto
                </button>
              )}
            </div>
          </Field>
          {manualAssign.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setManualAssign(new Map());
                setManualOrder(new Map());
                localStorage.removeItem(`route-overrides-${date}`);
              }}
              className="h-8 px-3 text-xs rounded border bg-background hover:bg-accent"
              title="Clear manual reassignments"
            >
              Reset moves ({manualAssign.size})
            </button>
          )}
          <button
            type="button"
            onClick={() => zoomToFitRef.current?.()}
            className="h-8 px-3 text-xs rounded border bg-background hover:bg-accent"
            title="Fit map to all delivery addresses"
          >
            Zoom to Fit
          </button>
          <div className="flex gap-1 ml-auto">
            <button
              type="button"
              onClick={handleExportPNG}
              className="h-8 px-3 text-xs rounded border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              title="Download route as PNG"
            >
              Export PNG
            </button>
            <button
              type="button"
              onClick={handleCopyPNG}
              disabled={copying}
              className="h-8 px-3 text-xs rounded border bg-background hover:bg-accent transition-colors disabled:opacity-50"
              title="Copy PNG to clipboard"
            >
              {copying ? "Copying…" : "Copy PNG"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (deliveries.length === 0) {
    return (
      <div className="space-y-3">
        {toolbar}
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No deliveries with coordinates today. Add coordinates on the Customers page.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}

      <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
        <Card className="overflow-hidden">
          <CardContent className="p-0 h-[calc(100vh-260px)] min-h-[500px]">
            {MapComponent ? (
              <MapComponent
                clusterData={clusterData}
                routeGeometries={routeGeometries}
                hub={hub}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReassign={handleReassign}
                isCalculating={isCalculating}
                zoomToFitRef={zoomToFitRef}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading map...
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 space-y-2 text-sm">
            <div className="font-semibold text-base mb-1">Summary</div>
            <Row
              label="Shippers"
              value={`${clusterData.length}${manualK !== null && manualK !== recommendedK ? ` (rec ${recommendedK})` : ""}`}
            />
            <Row label="Stops" value={String(totalStops)} />
            <Row label="Total dist" value={`${totalDistance.toFixed(1)} km`} />
            <Row label="Avg time" value={`${Math.ceil(avgTime)} min`} />
            <Row label="Max time" value={`${Math.ceil(maxTime)} min`} />
            <Row label="Total cost" value={`${Math.round(totalPrice).toLocaleString()} VND`} />
            {manualAssign.size > 0 && (
              <p className="text-xs text-amber-600 pt-1">
                {manualAssign.size} manual move{manualAssign.size > 1 ? "s" : ""}
              </p>
            )}
            {geometryFailed && !isCalculating && (
              <div className="pt-1 space-y-1">
                <p className="text-xs text-amber-600 leading-tight">
                  Road routing unavailable — showing straight lines.
                </p>
                <button
                  type="button"
                  onClick={() => setRetryCount((c) => c + 1)}
                  className="text-xs px-2 py-1 rounded border bg-background hover:bg-accent transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            {isCalculating && (
              <p className="text-xs text-muted-foreground pt-1 leading-tight">
                Calculating route…
              </p>
            )}
            <p className="text-xs text-muted-foreground pt-1 leading-tight">
              Drag within a card to reorder. Drag to another card to reassign.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {clusterData.map((cluster) => (
          <ShipperCard
            key={cluster.slotIdx}
            clusterIdx={cluster.slotIdx}
            cluster={cluster}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDropOnCluster}
            onReorder={handleReorder}
            draggingId={draggingId}
            isOverridden={(id) => manualAssign.has(id)}
            isReordered={(id) => {
              const order = manualOrder.get(cluster.slotIdx);
              return order !== undefined && order.indexOf(id) !== cluster.ordered.slice(1).findIndex((d) => d.id === id);
            }}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ShipperCard({
  clusterIdx,
  cluster,
  onDragStart,
  onDragEnd,
  onDrop,
  onReorder,
  draggingId,
  isOverridden,
  isReordered,
  selectedId,
  onSelect,
}: {
  clusterIdx: number;
  cluster: {
    ordered: Delivery[];
    stats: { distKm: number; cumDist: number }[];
    totalDist: number;
    totalTime: number;
    totalPrice: number;
    color: string;
  };
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetIdx: number) => void;
  onReorder: (clusterIdx: number, newOrderIds: string[]) => void;
  draggingId: string | null;
  isOverridden: (id: string) => boolean;
  isReordered: (id: string) => boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [cardOver, setCardOver] = useState(false);

  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current.get(selectedId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const stops = cluster.ordered.slice(1);
  const isDraggingFromThis = draggingId !== null && stops.some((d) => d.id === draggingId);

  return (
    <Card
      className="transition-shadow"
      style={cardOver && !isDraggingFromThis ? { boxShadow: `0 0 0 2px ${cluster.color}` } : undefined}
      onDragOver={(e) => { e.preventDefault(); if (!isDraggingFromThis) setCardOver(true); }}
      onDragLeave={() => setCardOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setCardOver(false);
        if (!isDraggingFromThis) onDrop(clusterIdx);
      }}
    >
      <CardContent className="py-2 px-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cluster.color }} />
          <div className="font-semibold text-sm">Shipper {clusterIdx + 1}</div>
          <div className="text-[10px] text-muted-foreground ml-auto text-right leading-tight">
            {cluster.totalDist.toFixed(1)}km · {Math.ceil(cluster.totalTime)}min
            <br />
            {Math.round(cluster.totalPrice).toLocaleString()} VND
          </div>
        </div>
        <div className="divide-y max-h-[220px] overflow-y-auto -mx-3">
          <div key="hub" className="px-3 py-1 flex items-center gap-2 bg-muted/30">
            <Badge variant="outline" className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] shrink-0">H</Badge>
            <span className="text-xs font-medium">Hub</span>
          </div>
          {stops.map((d, stopIdx) => {
            const idx = stopIdx + 1;
            const overridden = isOverridden(d.id);
            const reordered = isReordered(d.id);
            const isSelected = selectedId === d.id;
            const isDragTarget = isDraggingFromThis && dragOverItemId === d.id && draggingId !== d.id;
            return (
              <div
                key={d.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(d.id, el);
                  else rowRefs.current.delete(d.id);
                }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  onDragStart(d.id);
                }}
                onDragEnd={() => { setDragOverItemId(null); onDragEnd(); }}
                onDragEnter={(e) => { e.preventDefault(); if (isDraggingFromThis) setDragOverItemId(d.id); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverItemId(null);
                  if (isDraggingFromThis && draggingId && draggingId !== d.id) {
                    const ids = stops.map((s) => s.id);
                    const from = ids.indexOf(draggingId);
                    const to = ids.indexOf(d.id);
                    if (from !== -1 && to !== -1) {
                      ids.splice(from, 1);
                      ids.splice(to, 0, draggingId);
                      onReorder(clusterIdx, ids);
                    }
                    onDragEnd();
                  } else if (!isDraggingFromThis) {
                    onDrop(clusterIdx);
                  }
                }}
                onClick={() => onSelect(isSelected ? null : d.id)}
                style={{
                  ...(isSelected ? { background: cluster.color + "22", boxShadow: `inset 3px 0 0 ${cluster.color}` } : {}),
                  ...(isDragTarget ? { borderTop: `2px solid ${cluster.color}` } : {}),
                }}
                className={`px-3 py-1.5 flex items-start gap-2 cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-colors ${
                  draggingId === d.id ? "opacity-40" : ""
                } ${isSelected ? "font-medium" : ""}`}
                title="Drag up/down to reorder · drag to another card to reassign"
              >
                <Badge
                  variant="outline"
                  className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-full text-[10px]"
                  style={{ borderColor: cluster.color, color: cluster.color }}
                >
                  {idx}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-xs truncate flex items-center gap-1">
                    {d.name}
                    {overridden && <span className="text-[9px] text-amber-600 font-normal">●moved</span>}
                    {reordered && !overridden && <span className="text-[9px] text-blue-500 font-normal">●reordered</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{d.address}</p>
                  <p className="text-[10px] text-muted-foreground">+{cluster.stats[idx].distKm.toFixed(1)} km</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
