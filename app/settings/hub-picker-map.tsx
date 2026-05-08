"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function hubIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#ef4444;
      width:20px;height:20px;
      border-radius:50%;
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.45);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function HubPickerMap({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  // Keep marker in sync when lat/lng changes from inputs
  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  return (
    <div className="rounded-lg overflow-hidden border" style={{ height: 300 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          detectRetina={true}
        />
        <ClickHandler onPick={onPick} />
        <Marker
          position={[lat, lng]}
          icon={hubIcon()}
          ref={(m) => { markerRef.current = m; }}
          draggable
          eventHandlers={{
            dragend(e) {
              const ll = (e.target as L.Marker).getLatLng();
              onPick(ll.lat, ll.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
