"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Delivery = {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
};

type RouteMapProps = {
  deliveries: Delivery[];
};

async function fetchRoadGeometry(waypoints: { lat: number; lng: number }[]): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;
  try {
    const res = await fetch("/api/route-geometry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waypoints }),
      signal: AbortSignal.timeout(15000),
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

const DEFAULT_HUB = { lat: 10.7769, lng: 106.7009, address: "Hub" };
const DEFAULT_PRICE_PER_KM = 5000;

export function RouteMap({ deliveries }: RouteMapProps) {
  // Wrapped in an object so React doesn't treat the component fn as a state updater
  const [mapModule, setMapModule] = useState<{ Component: React.ComponentType<any> } | null>(null);
  const MapComponent = mapModule?.Component ?? null;
  const [routeGeometries, setRouteGeometries] = useState<([number, number][] | null)[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [geometryFailed, setGeometryFailed] = useState(false);

  const [hubInput, setHubInput] = useState(`${DEFAULT_HUB.lat}, ${DEFAULT_HUB.lng}`);
  const [hubAddress, setHubAddress] = useState(DEFAULT_HUB.address);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [pricePerKm, setPricePerKm] = useState<number>(DEFAULT_PRICE_PER_KM);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted settings after mount to avoid SSR/CSR hydration mismatch
  useEffect(() => {
    const savedHub = localStorage.getItem("route_hub");
    if (savedHub) setHubInput(savedHub);
    const savedAddr = localStorage.getItem("route_hub_address");
    if (savedAddr) setHubAddress(savedAddr);
    const savedConstraints = localStorage.getItem("route_constraints");
    if (savedConstraints) {
      try { setConstraints(JSON.parse(savedConstraints)); } catch { /* ignore */ }
    }
    const savedPrice = localStorage.getItem("route_price_per_km");
    if (savedPrice) setPricePerKm(parseFloat(savedPrice) || DEFAULT_PRICE_PER_KM);
    setHydrated(true);
  }, []);
  const [manualK, setManualK] = useState<number | null>(null);
  const [manualAssign, setManualAssign] = useState<Map<string, number>>(new Map());
  const [manualOrder, setManualOrder] = useState<Map<number, string[]>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hub = useMemo(() => {
    const m = hubInput.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
    if (!m) return { ...DEFAULT_HUB, address: hubAddress };
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]), address: hubAddress };
  }, [hubInput, hubAddress]);

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

  // Reset manual overrides when delivery set, hub, or shipper count changes
  useEffect(() => {
    setManualAssign(new Map());
  }, [deliveries.length, hub.lat, hub.lng, manualK]);

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

  // Reset manual ordering when cluster composition changes
  useEffect(() => {
    setManualOrder(new Map());
  }, [clusterResult]);

  // Per-cluster ordered deliveries with hub prepended; applies manual ordering overrides
  const clusterData = useMemo(() => {
    const hubDelivery: Delivery = { id: "__hub__", name: "Hub", phone: "", address: hub.address, lat: hub.lat, lng: hub.lng };
    return clusterResult.routes.map((routeIndices, ci) => {
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
      return { ordered, stats, totalDist, totalTime, totalPrice, color: CLUSTER_COLORS[ci % CLUSTER_COLORS.length] };
    });
  }, [clusterResult, deliveries, hub, constraints, pricePerKm, manualOrder]);

  // Fetch road geometries
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    if (clusterData.length === 0) { setRouteGeometries([]); return; }
    setIsCalculating(true);
    setGeometryFailed(false);
    Promise.all(
      clusterData.map((c) => (c.ordered.length >= 2 ? fetchRoadGeometry(c.ordered) : Promise.resolve(null)))
    ).then((geoms) => {
      setRouteGeometries(geoms);
      setIsCalculating(false);
      setGeometryFailed(geoms.every((g) => g === null));
    });
  }, [clusterData, retryCount]);

  // Dynamic Leaflet load
  useEffect(() => {
    import("./leaflet-map").then((mod) => setMapModule({ Component: mod.LeafletMap as React.ComponentType<any> }));
  }, []);

  const totalDistance = clusterData.reduce((s, c) => s + c.totalDist, 0);
  const totalPrice = totalDistance * pricePerKm;
  const totalStops = deliveries.length;
  const maxTime = Math.max(0, ...clusterData.map((c) => c.totalTime));
  const avgTime = clusterData.reduce((s, c) => s + c.totalTime, 0) / Math.max(1, clusterResult.k);

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd = () => setDraggingId(null);
  const handleDropOnCluster = (targetIdx: number) => {
    if (!draggingId) return;
    setManualAssign((prev) => {
      const next = new Map(prev);
      next.set(draggingId, targetIdx);
      return next;
    });
    setDraggingId(null);
  };

  const handleReassign = (deliveryId: string, targetIdx: number) => {
    setManualAssign((prev) => {
      const next = new Map(prev);
      next.set(deliveryId, targetIdx);
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
                  if (!isNaN(v) && v >= 1) setManualK(v);
                }}
                className="h-8 text-sm"
              />
              {manualK !== null && (
                <button
                  type="button"
                  onClick={() => setManualK(null)}
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
              onClick={() => setManualAssign(new Map())}
              className="h-8 px-3 text-xs rounded border bg-background hover:bg-accent"
              title="Clear manual reassignments"
            >
              Reset moves ({manualAssign.size})
            </button>
          )}
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
              value={`${clusterResult.k}${manualK !== null && manualK !== recommendedK ? ` (rec ${recommendedK})` : ""}`}
            />
            <Row label="Stops" value={String(totalStops)} />
            <Row label="Total dist" value={`${totalDistance.toFixed(1)} km`} />
            <Row label="Avg time" value={`${Math.ceil(avgTime)} min`} />
            <Row label="Max time" value={`${Math.ceil(maxTime)} min`} />
            <Row label="Total cost" value={`${Math.round(totalPrice).toLocaleString()}đ`} />
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
        {clusterData.map((cluster, ci) => (
          <ShipperCard
            key={ci}
            clusterIdx={ci}
            cluster={cluster}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDropOnCluster}
            onReorder={handleReorder}
            draggingId={draggingId}
            isOverridden={(id) => manualAssign.has(id)}
            isReordered={(id) => {
              const order = manualOrder.get(ci);
              return order !== undefined && order.indexOf(id) !== clusterData[ci].ordered.slice(1).findIndex((d) => d.id === id);
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
            {Math.round(cluster.totalPrice).toLocaleString()}đ
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
