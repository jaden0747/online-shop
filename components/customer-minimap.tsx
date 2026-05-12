"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDarkMode, TILE_URL_LIGHT, TILE_URL_DARK, TILE_ATTRIBUTION_LIGHT, TILE_ATTRIBUTION_DARK } from "@/lib/utils/use-dark-mode";
import type { CustomerAddress } from "@/lib/data/types";

type RouteData = {
  positions: [number, number][];
  distance: number;
  duration: number;
};

type CustomerMinimapProps = {
  addresses: CustomerAddress[];
  hub: { lat: number; lng: number };
  routes: Map<string, RouteData>;
  loading: boolean;
};

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#06b6d4"
];

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

function createAddressIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background: ${color};
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      border: 2.5px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    ">${label.charAt(0).toUpperCase()}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export function CustomerMinimap({ addresses, hub, routes, loading }: CustomerMinimapProps) {
  const dark = useDarkMode();
  const tileUrl = dark ? TILE_URL_DARK : TILE_URL_LIGHT;
  const tileAttr = dark ? TILE_ATTRIBUTION_DARK : TILE_ATTRIBUTION_LIGHT;

  const validAddresses = addresses.filter((a) => a.latitude != null && a.longitude != null);

  const allPoints: [number, number][] = [
    [hub.lat, hub.lng],
    ...validAddresses.map((a) => [a.latitude!, a.longitude!] as [number, number]),
  ];

  return (
    <div className="space-y-2">
      <div className="h-[300px] w-full rounded-lg overflow-hidden border">
        <MapContainer
          center={[hub.lat, hub.lng]}
          zoom={13}
          className="h-full w-full"
          scrollWheelZoom={true}
          zoomControl={false}
        >
          <TileLayer
            key={tileUrl}
            attribution={tileAttr}
            url={tileUrl}
            detectRetina={true}
          />

          <Marker position={[hub.lat, hub.lng]} icon={createHubIcon()}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold">Hub</p>
                <p className="text-xs text-gray-500 font-mono">{hub.lat.toFixed(5)}, {hub.lng.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>

          {validAddresses.map((addr, idx) => {
            const color = COLORS[idx % COLORS.length];
            const route = routes.get(addr.id);

            return (
              <Marker
                key={addr.id}
                position={[addr.latitude!, addr.longitude!]}
                icon={createAddressIcon(color, addr.label || "A")}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <p className="font-bold" style={{ color: color }}>{addr.label || "Address"}</p>
                    <p className="text-xs text-gray-600">{addr.address}</p>
                    {route && (
                      <div className="mt-1 pt-1 border-t">
                        <p className="text-xs text-gray-500">
                          {(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} min
                        </p>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {validAddresses.map((addr, idx) => {
            const color = COLORS[idx % COLORS.length];
            const route = routes.get(addr.id);
            const positions = route?.positions ?? [[hub.lat, hub.lng], [addr.latitude!, addr.longitude!]];

            return (
              <Polyline
                key={`route-${addr.id}`}
                positions={positions}
                pathOptions={{
                  color,
                  weight: 3,
                  opacity: 0.8,
                  dashArray: route ? undefined : "8 5",
                }}
              />
            );
          })}

          <FitBounds points={allPoints} />
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-gray-900 border-2 border-white shadow-sm" />
          Hub
        </div>
        {validAddresses.map((addr, idx) => {
          const color = COLORS[idx % COLORS.length];
          const route = routes.get(addr.id);
          return (
            <div key={addr.id} className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color, border: "2px solid white" }} />
              {addr.label || "Address"}
              {route && (
                <span className="text-muted-foreground/60">
                  · {(route.distance / 1000).toFixed(1)} km · {Math.round(route.duration / 60)} min
                </span>
              )}
              {loading && !route && (
                <span className="text-muted-foreground/40">· Loading...</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
