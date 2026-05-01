"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Pin, CoverageLeafletMap as CoverageLeafletMapType } from "./coverage-leaflet-map";

const ZONE_COLORS: Record<string, string> = {
  Q1: "#ef4444",
  Q2: "#3b82f6",
  Q3: "#10b981",
  Q4: "#f59e0b",
  Q7: "#f97316",
  Q8: "#6366f1",
  Q10: "#22c55e",
  "Tân Bình": "#8b5cf6",
  "Tân Phú": "#ec4899",
  "Bình Thạnh": "#06b6d4",
  "Gò Vấp": "#84cc16",
  "Phú Nhuận": "#f43f5e",
  "Nhà Bè": "#78716c",
  "Thủ Đức": "#ca8a04",
  "Bình Tân": "#0ea5e9",
};

export function CoverageMap({ pins }: { pins: Pin[] }) {
  const [MapComponent, setMapComponent] = useState<typeof CoverageLeafletMapType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeZones, setActiveZones] = useState<Set<string>>(new Set());

  useEffect(() => {
    import("./coverage-leaflet-map").then((mod) =>
      setMapComponent(() => mod.CoverageLeafletMap)
    );
  }, []);

  const zones = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pins) {
      const z = p.zone || "Unknown";
      counts.set(z, (counts.get(z) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([zone, count]) => ({ zone, count, color: ZONE_COLORS[zone] ?? "#888" }));
  }, [pins]);

  const visiblePins = useMemo(
    () =>
      activeZones.size === 0
        ? pins
        : pins.filter((p) => activeZones.has(p.zone || "Unknown")),
    [pins, activeZones]
  );

  function toggleZone(zone: string) {
    setActiveZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
    setSelectedId(null);
  }

  function clearFilter() {
    setActiveZones(new Set());
    setSelectedId(null);
  }

  return (
    <div className="space-y-3">
      {/* Zone filter chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-muted-foreground mr-1">Filter by zone:</span>
        {zones.map(({ zone, count, color }) => {
          const active = activeZones.has(zone);
          return (
            <button
              key={zone}
              type="button"
              onClick={() => toggleZone(zone)}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-all"
              style={{
                borderColor: color,
                background: active ? color : "transparent",
                color: active ? "#fff" : color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: active ? "#ffffff99" : color }}
              />
              {zone}
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
        {activeZones.size > 0 && (
          <button
            type="button"
            onClick={clearFilter}
            className="text-xs px-2 py-1 rounded-full border border-muted-foreground/30 text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        {/* Map */}
        <Card className="overflow-hidden">
          <CardContent className="p-0 h-[calc(100vh-230px)] min-h-[500px]">
            {MapComponent ? (
              <MapComponent
                pins={visiblePins}
                zoneColors={ZONE_COLORS}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading map…
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer list */}
        <Card>
          <CardContent className="py-3 px-0">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {visiblePins.length} customer{visiblePins.length !== 1 ? "s" : ""}
              {activeZones.size > 0 ? ` in ${activeZones.size} zone${activeZones.size > 1 ? "s" : ""}` : ""}
            </p>
            <div className="overflow-y-auto max-h-[calc(100vh-280px)] divide-y">
              {visiblePins.map((pin) => {
                const color = ZONE_COLORS[pin.zone] ?? "#888";
                const isSelected = selectedId === pin.id;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : pin.id)}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors"
                    style={
                      isSelected
                        ? { background: color + "18", boxShadow: `inset 3px 0 0 ${color}` }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{pin.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{pin.address}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
