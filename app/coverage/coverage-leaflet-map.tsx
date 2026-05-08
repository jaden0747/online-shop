"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useDarkMode, TILE_URL_LIGHT, TILE_URL_DARK, TILE_ATTRIBUTION_LIGHT, TILE_ATTRIBUTION_DARK } from "@/lib/utils/use-dark-mode";

export type Pin = {
  id: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
};

function createDotIcon(color: string, selected: boolean) {
  const size = selected ? 34 : 26;
  const shadow = selected
    ? `0 0 0 3px ${color}55, 0 2px 8px rgba(0,0,0,0.45)`
    : "0 2px 5px rgba(0,0,0,0.35)";
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      width:${size}px;height:${size}px;
      border-radius:50%;
      border:2.5px solid white;
      box-shadow:${shadow};
      transition:all 0.15s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

function FitBounds({ pins }: { pins: Pin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.06));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function FocusPin({
  selectedId,
  markerRefs,
}: {
  selectedId: string | null;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const marker = markerRefs.current.get(selectedId);
    if (!marker) return;
    map.panTo(marker.getLatLng(), { animate: true });
    marker.openPopup();
  }, [selectedId, map, markerRefs]);
  return null;
}

function ZoomToFitRegistrar({
  zoomToFitRef,
  pins,
}: {
  zoomToFitRef: React.MutableRefObject<(() => void) | null>;
  pins: Pin[];
}) {
  const map = useMap();
  useEffect(() => {
    zoomToFitRef.current = () => {
      if (pins.length === 0) return;
      const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
    };
    return () => { zoomToFitRef.current = null; };
  }, [map, zoomToFitRef, pins]);
  return null;
}

export function CoverageLeafletMap({
  pins,
  zoneColors,
  selectedId,
  onSelect,
  zoomToFitRef,
}: {
  pins: Pin[];
  zoneColors: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  zoomToFitRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const dark = useDarkMode();
  const tileUrl = dark ? TILE_URL_DARK : TILE_URL_LIGHT;
  const tileAttr = dark ? TILE_ATTRIBUTION_DARK : TILE_ATTRIBUTION_LIGHT;

  if (pins.length === 0) return null;

  const bounds: [[number, number], [number, number]] = [
    [Math.min(...pins.map((p) => p.lat)) - 0.01, Math.min(...pins.map((p) => p.lng)) - 0.01],
    [Math.max(...pins.map((p) => p.lat)) + 0.01, Math.max(...pins.map((p) => p.lng)) + 0.01],
  ];

  return (
    <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        key={tileUrl}
        attribution={tileAttr}
        url={tileUrl}
        detectRetina={true}
      />
      <FitBounds pins={pins} />
      <FocusPin selectedId={selectedId} markerRefs={markerRefs} />
      {zoomToFitRef && <ZoomToFitRegistrar zoomToFitRef={zoomToFitRef} pins={pins} />}
      {pins.map((pin) => {
        const color = zoneColors[pin.zone] ?? "#888";
        const selected = selectedId === pin.id;
        return (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createDotIcon(color, selected)}
            ref={(m) => {
              if (m) markerRefs.current.set(pin.id, m);
              else markerRefs.current.delete(pin.id);
            }}
            eventHandlers={{
              click: () => onSelect(pin.id),
              popupclose: () => {
                if (selectedId === pin.id) onSelect(null);
              },
            }}
          >
            <Popup>
              <div className="text-sm min-w-[180px] space-y-0.5">
                <p className="font-bold">{pin.name}</p>
                <p className="text-xs">{pin.address}</p>
                <p className="text-xs text-gray-500">{pin.phone}</p>
                <p
                  className="text-[11px] font-semibold mt-1 inline-block px-1.5 py-0.5 rounded"
                  style={{ background: color + "22", color }}
                >
                  {pin.zone || "No zone"}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
