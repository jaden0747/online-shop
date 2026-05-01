"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "../actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

export function AddCustomerForm() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, action, pending] = useActionState(async (_: unknown, formData: FormData) => {
    await createCustomerAction(formData);
    setOpen(false);
    router.refresh();
    return null;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>+ Add Customer</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Customer</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="zone">Zone / District</Label>
            <Input id="zone" name="zone" placeholder="e.g. Quận 1" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="coordinates">Coordinates (optional)</Label>
            <Input id="coordinates" name="coordinates" placeholder="latitude, longitude" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save Customer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
