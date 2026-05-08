"use client";

import { useState } from "react";
import { CustomerOverlay } from "@/components/customer-overlay";

export function ShippingCustomerCell({
  customerId,
  name,
  phone,
  permanentNote,
}: {
  customerId: string;
  name: string;
  phone: string;
  permanentNote?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="text-left" onClick={() => setOpen(true)}>
        <span className="font-medium block hover:underline">{name}</span>
        <span className="text-xs text-muted-foreground block">{phone}</span>
        {permanentNote && (
          <span className="text-xs text-muted-foreground/70 italic block truncate max-w-[160px]" title={permanentNote}>
            · {permanentNote}
          </span>
        )}
      </button>
      <CustomerOverlay customerId={customerId} open={open} onOpenChange={setOpen} />
    </>
  );
}
