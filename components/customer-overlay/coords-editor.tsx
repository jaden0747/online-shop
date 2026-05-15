"use client";

import { useState, useTransition } from "react";
import { updateAddressCoordsStringAction } from "@/app/actions/addresses";
import { MapPin, Check, X } from "lucide-react";

export function CoordsEditor({
  addressId,
  customerId,
  lat,
  lng,
  onSaved,
}: {
  addressId: string;
  customerId: string;
  lat: number | null;
  lng: number | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lat != null && lng != null ? `${lat}, ${lng}` : "");
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      await updateAddressCoordsStringAction(addressId, customerId, value.trim());
      setEditing(false);
      onSaved();
    });
  }

  if (!editing) {
    const hasCoords = lat != null && lng != null;
    return (
      <button
        type="button"
        onClick={() => { setValue(lat != null && lng != null ? `${lat}, ${lng}` : ""); setEditing(true); }}
        className={[
          "flex items-center gap-1 text-xs mt-0.5",
          hasCoords
            ? "text-emerald-600 hover:text-emerald-700"
            : "text-amber-500 hover:text-amber-600",
        ].join(" ")}
      >
        <MapPin size={10} />
        {hasCoords ? `${lat?.toFixed(5)}, ${lng?.toFixed(5)}` : "Add coords"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <input
        autoFocus
        className="flex-1 text-xs bg-transparent border-b border-input outline-none focus:border-ring pb-0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="lat, lng"
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-5 w-5 flex items-center justify-center rounded text-emerald-600 hover:bg-accent disabled:opacity-50"
      >
        <Check size={10} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent"
      >
        <X size={10} />
      </button>
    </div>
  );
}
