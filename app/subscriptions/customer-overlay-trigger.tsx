"use client";

import { useState } from "react";
import { CustomerOverlay } from "@/components/customer-overlay";

export function CustomerOverlayTrigger({
  customerId,
  name,
  phone,
}: {
  customerId: string;
  name: string;
  phone: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-left" onClick={() => setOpen(true)}>
        <span className="font-medium leading-none block hover:underline">{name}</span>
        <span className="text-xs text-muted-foreground">{phone}</span>
      </button>
      <CustomerOverlay customerId={customerId} open={open} onOpenChange={setOpen} />
    </>
  );
}
