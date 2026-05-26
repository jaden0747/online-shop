"use client";

import { useState } from "react";
import { CustomerOverlay } from "@/components/customer-overlay";
import { PhoneDisplay } from "@/components/phone-display";

export function CustomerOverlayTrigger({
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
      <div className="text-left">
        <button type="button" className="text-left" onClick={() => setOpen(true)}>
          <span className="font-medium leading-none block hover:underline">{name}</span>
          {permanentNote && (
            <span className="text-xs text-blue-600 dark:text-blue-400 block whitespace-pre-wrap">
              · {permanentNote}
            </span>
          )}
        </button>
        <PhoneDisplay phone={phone} />
      </div>
      {open && <CustomerOverlay customerId={customerId} open={open} onOpenChange={setOpen} />}
    </>
  );
}
