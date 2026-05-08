"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { updateSettingsAction } from "@/app/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const HubPickerMap = dynamic(
  () => import("./hub-picker-map").then((m) => m.HubPickerMap),
  { ssr: false }
);

interface HubFormProps {
  hubLat: number;
  hubLng: number;
}

async function formAction(_prev: boolean | null, formData: FormData): Promise<boolean> {
  await updateSettingsAction(formData);
  return true;
}

export function HubForm({ hubLat, hubLng }: HubFormProps) {
  const [saved, action, isPending] = useActionState(formAction, null);
  const [lat, setLat] = useState(hubLat);
  const [lng, setLng] = useState(hubLng);

  function handlePick(pickedLat: number, pickedLng: number) {
    setLat(Math.round(pickedLat * 1e6) / 1e6);
    setLng(Math.round(pickedLng * 1e6) / 1e6);
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="hubLat">Latitude</Label>
          <Input
            id="hubLat"
            name="hubLat"
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hubLng">Longitude</Label>
          <Input
            id="hubLng"
            name="hubLng"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Click or drag the marker to set the hub location.</p>
      <HubPickerMap lat={lat} lng={lng} onPick={handlePick} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved.</span>}
      </div>
    </form>
  );
}
