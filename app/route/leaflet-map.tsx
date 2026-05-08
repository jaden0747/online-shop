"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDarkMode, TILE_URL_LIGHT, TILE_URL_DARK, TILE_ATTRIBUTION_LIGHT, TILE_ATTRIBUTION_DARK } from "@/lib/utils/use-dark-mode";

type Delivery = {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
};

type ClusterData = {
  ordered: Delivery[];
  color: string;
  slotIdx?: number;
};

function createNumberedIcon(num: number, color: string, selected: boolean) {
  const size = selected ? 36 : 28;
  const ring = selected
    ? `0 0 0 3px ${color}, 0 2px 8px rgba(0,0,0,0.5)`
    : `0 2px 6px rgba(0,0,0,0.4)`;
  return L.divIcon({
    className: "",
    html: `<div style="
      background: ${color};
      color: white;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${selected ? 13 : 11}px;
      font-weight: bold;
      border: 2.5px solid white;
      box-shadow: ${ring};
      transition: all 0.15s ease;
    ">${num}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createHubIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      background: #111;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    ">H</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/** Pans map to selected delivery and opens its popup. */
function FocusOnSelected({
  selectedId,
  markerRefs,
  positions,
}: {
  selectedId: string | null;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
  positions: Map<string, [number, number]>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const pos = positions.get(selectedId);
    if (pos) map.panTo(pos, { animate: true });
    const marker = markerRefs.current.get(selectedId);
    if (marker) marker.openPopup();
  }, [selectedId, map, markerRefs, positions]);
  return null;
}

/** Registers map instance so external "Zoom to Fit" can call fitBounds. */
function ZoomToFitRegistrar({
  zoomToFitRef,
  allPoints,
}: {
  zoomToFitRef: React.MutableRefObject<(() => void) | null>;
  allPoints: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    zoomToFitRef.current = () => {
      if (allPoints.length === 0) return;
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [20, 20] });
    };
    return () => { zoomToFitRef.current = null; };
  }, [map, zoomToFitRef, allPoints]);
  return null;
}

/**
 * Shifts a lat/lng point perpendicular to `bearingDeg` by `distDeg` degrees.
 * Positive distDeg offsets to the right of the bearing direction.
 */
function offsetLatLng(
  lat: number,
  lng: number,
  bearingDeg: number,
  distDeg: number,
): [number, number] {
  const perpBearing = (bearingDeg + 90) % 360;
  const rad = (perpBearing * Math.PI) / 180;
  return [
    lat + distDeg * Math.cos(rad),
    lng + distDeg * Math.sin(rad),
  ];
}

/** Returns bearing in degrees from point A to point B. */
function bearingDeg(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLng = bLng - aLng;
  const dLat = bLat - aLat;
  return (Math.atan2(dLng, dLat) * 180) / Math.PI;
}

/** Canonical edge key (undirected) so A→B and B→A are the same edge. */
function edgeKey(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): string {
  const a = `${aLat.toFixed(6)},${aLng.toFixed(6)}`;
  const b = `${bLat.toFixed(6)},${bLng.toFixed(6)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const OFFSET_DEG = 0.00005;

/**
 * Builds offset polyline segments for a cluster route.
 * For each consecutive pair in `pts`, checks if the edge is shared with other shippers.
 * If shared, applies a perpendicular offset based on the shipper's index among all users of that edge.
 * Returns an array of polyline position arrays (one per contiguous run of same-offset segments).
 */
function buildOffsetSegments(
  pts: [number, number][],
  ci: number,
  edgeShippers: Map<string, number[]>,
): [number, number][][] {
  if (pts.length < 2) return pts.length > 0 ? [pts] : [];

  const result: [number, number][][] = [];
  let current: [number, number][] = [pts[0]];

  for (let i = 0; i < pts.length - 1; i++) {
    const [aLat, aLng] = pts[i];
    const [bLat, bLng] = pts[i + 1];
    const key = edgeKey(aLat, aLng, bLat, bLng);
    const shippers = edgeShippers.get(key);

    if (!shippers || shippers.length < 2) {
      current.push([bLat, bLng]);
    } else {
      const rank = shippers.indexOf(ci);
      const total = shippers.length;
      const offsetMultiplier = rank - (total - 1) / 2;
      const dist = offsetMultiplier * OFFSET_DEG;
      const bearing = bearingDeg(aLat, aLng, bLat, bLng);
      const [oaLat, oaLng] = offsetLatLng(aLat, aLng, bearing, dist);
      const [obLat, obLng] = offsetLatLng(bLat, bLng, bearing, dist);

      if (current.length > 1) {
        result.push(current);
      }
      result.push([[oaLat, oaLng], [obLat, obLng]]);
      current = [[bLat, bLng]];
    }
  }

  if (current.length > 1) result.push(current);
  return result;
}

export function LeafletMap({
  clusterData,
  routeGeometries,
  hub,
  selectedId,
  onSelect,
  onReassign,
  isCalculating,
  zoomToFitRef,
}: {
  clusterData: ClusterData[];
  routeGeometries: ([number, number][] | null)[];
  hub: { lat: number; lng: number; address: string };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReassign: (deliveryId: string, targetClusterIdx: number) => void;
  isCalculating?: boolean;
  zoomToFitRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const iconCache = useRef<Map<string, L.DivIcon>>(new Map());
  const hubIconRef = useRef<L.DivIcon | null>(null);
  const dark = useDarkMode();
  const tileUrl = dark ? TILE_URL_DARK : TILE_URL_LIGHT;
  const tileAttr = dark ? TILE_ATTRIBUTION_DARK : TILE_ATTRIBUTION_LIGHT;

  function getNumberedIcon(num: number, color: string, selected: boolean): L.DivIcon {
    const key = `${num}|${color}|${selected}`;
    if (!iconCache.current.has(key)) {
      iconCache.current.set(key, createNumberedIcon(num, color, selected));
    }
    return iconCache.current.get(key)!;
  }

  function getHubIcon(): L.DivIcon {
    if (!hubIconRef.current) hubIconRef.current = createHubIcon();
    return hubIconRef.current;
  }

  if (clusterData.length === 0) return null;

  const allDeliveryPoints = clusterData.flatMap((c) => c.ordered).filter((d) => d.id !== "__hub__");
  const lats = allDeliveryPoints.map((d) => d.lat);
  const lngs = allDeliveryPoints.map((d) => d.lng);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats) - 0.002, Math.min(...lngs) - 0.002],
    [Math.max(...lats) + 0.002, Math.max(...lngs) + 0.002],
  ];

  const allPointsForZoom: [number, number][] = allDeliveryPoints.map((d) => [d.lat, d.lng]);

  const positions = new Map<string, [number, number]>();
  clusterData.forEach((c) =>
    c.ordered.forEach((d) => {
      if (d.id !== "__hub__") positions.set(d.id, [d.lat, d.lng]);
    })
  );

  const findCurrentCluster = (id: string): number => {
    for (let ci = 0; ci < clusterData.length; ci++) {
      if (clusterData[ci].ordered.some((d) => d.id === id)) return ci;
    }
    return -1;
  };

  // Build edge → [shipperIndices] map for overlap detection
  const edgeShippers = new Map<string, number[]>();
  if (!isCalculating) {
    clusterData.forEach((cluster, ci) => {
      const geom = routeGeometries[ci];
      const pts: [number, number][] = geom ?? cluster.ordered.map((d) => [d.lat, d.lng]);
      for (let i = 0; i < pts.length - 1; i++) {
        const key = edgeKey(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        const existing = edgeShippers.get(key);
        if (existing) {
          if (!existing.includes(ci)) existing.push(ci);
        } else {
          edgeShippers.set(key, [ci]);
        }
      }
    });
  }

  return (
    <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom={true}>
      <TileLayer
        key={tileUrl}
        attribution={tileAttr}
        url={tileUrl}
        detectRetina={true}
      />
      {/* Casing pass — dark outline drawn first (below colored lines) */}
      {!isCalculating && clusterData.map((cluster, ci) => {
        const geom = routeGeometries[ci];
        const pts: [number, number][] = geom ?? cluster.ordered.map((d) => [d.lat, d.lng]);
        const segments = buildOffsetSegments(pts, ci, edgeShippers);
        return segments.map((seg, si) => (
          <Polyline
            key={`casing-${clusterData.length}-${ci}-${cluster.color}-${si}`}
            positions={seg}
            pathOptions={{
              color: dark ? "#000000" : "#ffffff",
              weight: 6,
              opacity: 0.6,
              dashArray: geom ? undefined : "8 5",
            }}
          />
        ));
      })}
      {/* Color pass — thinner colored line on top */}
      {!isCalculating && clusterData.map((cluster, ci) => {
        const geom = routeGeometries[ci];
        const pts: [number, number][] = geom ?? cluster.ordered.map((d) => [d.lat, d.lng]);
        const segments = buildOffsetSegments(pts, ci, edgeShippers);
        return segments.map((seg, si) => (
          <Polyline
            key={`route-${clusterData.length}-${ci}-${cluster.color}-${si}`}
            positions={seg}
            pathOptions={{
              color: cluster.color,
              weight: 4,
              opacity: 0.95,
              dashArray: geom ? undefined : "8 5",
            }}
          />
        ));
      })}

      <Marker position={[hub.lat, hub.lng]} icon={getHubIcon()}>
        <Popup>
          <div className="text-sm">
            <p className="font-bold">Hub</p>
            <p>{hub.address}</p>
            <p className="text-xs text-gray-500 font-mono">{hub.lat}, {hub.lng}</p>
          </div>
        </Popup>
      </Marker>

      {clusterData.map((cluster, ci) =>
        cluster.ordered
          .filter((d) => d.id !== "__hub__")
          .map((d, idx) => {
            const isSelected = selectedId === d.id;
            const pinColor = isCalculating ? "#9ca3af" : cluster.color;
            return (
              <Marker
                key={`${clusterData.length}-${ci}-${d.id}-${cluster.color}`}
                position={[d.lat, d.lng]}
                icon={getNumberedIcon(idx + 1, pinColor, isSelected)}
                ref={(m) => {
                  if (m) markerRefs.current.set(d.id, m);
                  else markerRefs.current.delete(d.id);
                }}
                eventHandlers={{
                  click: () => onSelect(d.id),
                  popupclose: () => {
                    if (selectedId === d.id) onSelect(null);
                  },
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <p className="font-bold mb-1">
                      <span style={{ color: cluster.color }}>S{ci + 1}</span> #{idx + 1} {d.name}
                    </p>
                    <p className="text-xs">{d.address}</p>
                    {d.phone && <p className="text-xs text-gray-500">{d.phone}</p>}
                    <p className="text-xs text-gray-500 font-mono mb-2">{d.lat}, {d.lng}</p>
                    {clusterData.length > 1 && (
                      <div>
                        <p className="text-[11px] font-medium text-gray-700 mb-1">Move to shipper:</p>
                        <div className="flex flex-wrap gap-1">
                          {clusterData.map((other, oi) => {
                            const current = findCurrentCluster(d.id);
                            const isCurrent = oi === current;
                            const targetSlot = other.slotIdx ?? oi;
                            return (
                              <button
                                key={oi}
                                type="button"
                                disabled={isCurrent}
                                onClick={() => onReassign(d.id, targetSlot)}
                                style={{
                                  background: isCurrent ? "#fff" : other.color,
                                  color: isCurrent ? other.color : "#fff",
                                  borderColor: other.color,
                                }}
                                className={`text-[11px] font-semibold px-2 py-1 rounded border transition-opacity ${
                                  isCurrent
                                    ? "opacity-60 cursor-default"
                                    : "hover:opacity-85 cursor-pointer"
                                }`}
                                title={isCurrent ? "Current shipper" : `Move to Shipper ${oi + 1}`}
                              >
                                S{oi + 1}
                                {isCurrent ? " ✓" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })
      )}

      <FocusOnSelected
        selectedId={selectedId}
        markerRefs={markerRefs}
        positions={positions}
      />
      {zoomToFitRef && (
        <ZoomToFitRegistrar zoomToFitRef={zoomToFitRef} allPoints={allPointsForZoom} />
      )}
    </MapContainer>
  );
}
