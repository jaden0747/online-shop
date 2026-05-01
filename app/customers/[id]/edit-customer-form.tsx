"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "../../actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  notes: string | null;
};

export function EditCustomerForm({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      await updateCustomerAction(customer.id, formData);
      setOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Pencil size={14} className="mr-1" /> Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={customer.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={customer.phone} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">Primary address</Label>
            <Input id="address" name="address" defaultValue={customer.address} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="zone">Zone / District</Label>
            <Input id="zone" name="zone" defaultValue={customer.zone} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" defaultValue={customer.notes ?? ""} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
