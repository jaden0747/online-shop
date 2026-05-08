"use client";

import { useState } from "react";
import { CustomerOverlay } from "@/components/customer-overlay";

export function CustomerNameButton({
  customerId,
  name,
}: {
  customerId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="font-medium hover:underline underline-offset-2 text-left"
        onClick={() => setOpen(true)}
      >
        {name}
      </button>
      <CustomerOverlay customerId={customerId} open={open} onOpenChange={setOpen} />
    </>
  );
}
