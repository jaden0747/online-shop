"use client";

import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAddressAction,
  setDefaultAddressAction,
  deleteAddressAction,
  updateAddressCoordinatesAction,
} from "../../actions/addresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Trash2, Plus, Pencil } from "lucide-react";

type Address = {
  id: string;
  label: string;
  address: string;
  zone: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
};

function parseCoords(val: string): { latitude: number | null; longitude: number | null } {
  const m = val.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!m) return { latitude: null, longitude: null };
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
}

export function ManageAddresses({
  customerId,
  addresses,
}: {
  customerId: string;
  addresses: Address[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [, addAction, addPending] = useActionState(
    async (_: unknown, formData: FormData) => {
      await createAddressAction(formData);
      setAddOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  return (
    <div className="space-y-3">
      {addresses.length === 0 && (
        <p className="text-xs text-muted-foreground">No extra addresses. The primary address is used by default.</p>
      )}
      {addresses.map((addr) => {
        const hasCoords = addr.latitude !== null && addr.longitude !== null;
        return (
          <div key={addr.id} className="rounded-lg border px-3 py-2 text-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{addr.label}</span>
                  {addr.isDefault && <Badge variant="secondary" className="text-xs">default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{addr.address} · {addr.zone}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasCoords && (
                  <EditCoordsButton addr={addr} customerId={customerId} onDone={() => router.refresh()} />
                )}
                {!addr.isDefault && (
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    disabled={pending}
                    onClick={() => startTransition(async () => { await setDefaultAddressAction(addr.id, customerId); router.refresh(); })}
                    title="Set as default"
                  >
                    <Star size={13} />
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => startTransition(async () => { await deleteAddressAction(addr.id, customerId); router.refresh(); })}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>

            {hasCoords ? (
              <p className="text-[11px] font-mono text-green-700">
                {addr.latitude}, {addr.longitude}
              </p>
            ) : (
              <InlineCoordsEdit addr={addr} customerId={customerId} onDone={() => router.refresh()} />
            )}
          </div>
        );
      })}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <Plus size={13} className="mr-1" /> Add address
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Delivery Address</DialogTitle>
          </DialogHeader>
          <form action={addAction} className="space-y-4">
            <input type="hidden" name="customerId" value={customerId} />
            <div className="space-y-1">
              <Label htmlFor="addrLabel">Label</Label>
              <Input id="addrLabel" name="label" placeholder="e.g. Home, Office" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addrAddress">Address</Label>
              <Input id="addrAddress" name="address" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addrZone">Zone / District</Label>
              <Input id="addrZone" name="zone" placeholder="e.g. Quận 1" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addrCoords">Coordinates (optional)</Label>
              <Input id="addrCoords" name="coordinates" placeholder="latitude, longitude" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" value="true" />
              Set as default address
            </label>
            <Button type="submit" className="w-full" disabled={addPending}>
              {addPending ? "Saving…" : "Save Address"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlineCoordsEdit({
  addr,
  customerId,
  onDone,
}: {
  addr: Address;
  customerId: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const parsed = parseCoords(value);
  const valid = parsed.latitude !== null && parsed.longitude !== null;

  function handleSave() {
    if (!valid) return;
    startTransition(async () => {
      await updateAddressCoordinatesAction(addr.id, customerId, parsed.latitude, parsed.longitude);
      onDone();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        placeholder="latitude, longitude"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 text-xs font-mono"
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
      />
      <Button
        size="sm"
        className="h-7 px-3 shrink-0"
        disabled={pending || !valid}
        onClick={handleSave}
      >
        {pending ? "…" : "Save"}
      </Button>
    </div>
  );
}

function EditCoordsButton({
  addr,
  customerId,
  onDone,
}: {
  addr: Address;
  customerId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(v: boolean) {
    if (v) setValue(addr.latitude !== null && addr.longitude !== null ? `${addr.latitude}, ${addr.longitude}` : "");
    setOpen(v);
  }

  function handleSave() {
    const { latitude, longitude } = parseCoords(value);
    startTransition(async () => {
      await updateAddressCoordinatesAction(addr.id, customerId, latitude, longitude);
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit coordinates" />}>
        <Pencil size={13} />
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Coordinates — {addr.label}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{addr.address}</p>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Coordinates</Label>
            <Input
              placeholder="latitude, longitude"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>
          <Button className="w-full" disabled={pending} onClick={handleSave}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
