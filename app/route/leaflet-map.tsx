"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

export function LeafletMap({
  clusterData,
  routeGeometries,
  hub,
  selectedId,
  onSelect,
  onReassign,
  isCalculating,
}: {
  clusterData: ClusterData[];
  routeGeometries: ([number, number][] | null)[];
  hub: { lat: number; lng: number; address: string };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReassign: (deliveryId: string, targetClusterIdx: number) => void;
  isCalculating?: boolean;
}) {
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  if (clusterData.length === 0) return null;

  const allPoints = clusterData.flatMap((c) => c.ordered);
  const lats = allPoints.map((d) => d.lat);
  const lngs = allPoints.map((d) => d.lng);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats) - 0.005, Math.min(...lngs) - 0.005],
    [Math.max(...lats) + 0.005, Math.max(...lngs) + 0.005],
  ];

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

  return (
    <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {!isCalculating && clusterData.map((cluster, ci) => {
        const geom = routeGeometries[ci];
        // Fall back to straight lines if OSRM geometry is unavailable
        const positions: [number, number][] = geom ?? cluster.ordered.map((d) => [d.lat, d.lng]);
        return (
          <Polyline
            key={`route-${clusterData.length}-${ci}-${cluster.color}`}
            positions={positions}
            pathOptions={{
              color: cluster.color,
              weight: 6,
              opacity: 0.85,
              dashArray: geom ? undefined : "8 5",
            }}
          />
        );
      })}

      <Marker position={[hub.lat, hub.lng]} icon={createHubIcon()}>
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
                icon={createNumberedIcon(idx + 1, pinColor, isSelected)}
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
                            return (
                              <button
                                key={oi}
                                type="button"
                                disabled={isCurrent}
                                onClick={() => onReassign(d.id, oi)}
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
    </MapContainer>
  );
}
