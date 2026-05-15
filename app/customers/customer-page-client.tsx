"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerOverlay } from "@/components/customer-overlay";
import { RecentCustomersPanel } from "./recent-customers-panel";
import { UnifiedCustomerTable } from "./unified-customer-table";
import type { CustomerRow } from "./unified-customer-table";

type NewCustomer = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

export function CustomerPageClient({
  rows,
  recentlyCreated,
  initialOverlayId,
}: {
  rows: CustomerRow[];
  recentlyCreated: NewCustomer[];
  initialOverlayId?: string;
}) {
  const router = useRouter();
  const [overlayId, setOverlayId] = useState<string | null>(initialOverlayId ?? null);

  return (
    <>
      {overlayId && (
        <CustomerOverlay
          customerId={overlayId}
          open={!!overlayId}
          onOpenChange={(o) => {
            if (!o) {
              setOverlayId(null);
              router.refresh();
            }
          }}
        />
      )}
      <RecentCustomersPanel recentlyCreated={recentlyCreated} onOpenCustomer={setOverlayId} />
      <UnifiedCustomerTable rows={rows} onOpenCustomer={setOverlayId} />
    </>
  );
}
