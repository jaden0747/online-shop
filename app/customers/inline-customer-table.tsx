"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isSubscriptionLive, daysRemaining } from "@/lib/utils/subscription";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { CustomerOverlay } from "@/components/customer-overlay";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  zone: string;
  notes: string | null;
};

type Sub = {
  id: string;
  customerId: string;
  plan: string;
  goal: string;
  mealsPerDay: number;
  status: string;
  startDate: string;
  renewalDate: string;
};

type Props = {
  customers: Customer[];
  subscriptions: Sub[];
  onCustomerClick?: (customerId: string) => void;
};


function RenewalCell({ sub }: { sub: Sub | null }) {
  if (!sub) {
    return <span className="text-muted-foreground">—</span>;
  }

  const isLive = isSubscriptionLive(sub.status, sub.startDate, sub.renewalDate);

  if (!isLive) {
    // cancelled or expired
    return (
      <Badge variant="outline" className="capitalize text-xs">
        {sub.status}
      </Badge>
    );
  }

  const days = daysRemaining(sub.renewalDate);
  let colorClass = "text-green-600";
  if (days <= 6) colorClass = "text-red-600";
  else if (days <= 13) colorClass = "text-yellow-600";

  return (
    <span className={`font-medium text-sm ${colorClass}`}>
      {days} days
    </span>
  );
}

export function InlineCustomerTable({ customers, subscriptions, onCustomerClick }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [overlayId, setOverlayId] = useState<string | null>(null);

  function openOverlay(id: string) {
    setOverlayId(id);
    onCustomerClick?.(id);
  }

  const filtered = search.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : customers;

  return (
    <div>
      {overlayId && (
        <CustomerOverlay
          customerId={overlayId}
          open={!!overlayId}
          onOpenChange={(o) => { if (!o) { setOverlayId(null); router.refresh(); } }}
        />
      )}
      <div className="px-4 py-2 border-b">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Phone</th>
              <th className="text-left px-4 py-2 font-medium">Zone</th>
              <th className="text-left px-4 py-2 font-medium">Plan</th>
              <th className="text-left px-4 py-2 font-medium w-8">Note</th>
              <th className="text-left px-4 py-2 font-medium">Renewal</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  {search.trim() ? `No customers matching "${search}"` : "No customers yet. Add your first one."}
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const activeSub =
                subscriptions.find(
                  (s) => s.customerId === c.id && isSubscriptionLive(s.status, s.startDate, s.renewalDate)
                ) ?? null;
              const anySub =
                activeSub ??
                subscriptions.find((s) => s.customerId === c.id) ??
                null;

              return (
                <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => openOverlay(c.id)}
                      className="font-medium hover:underline text-left"
                    >
                      {c.name || <span className="text-muted-foreground">—</span>}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {c.phone}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {c.zone || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    {anySub ? (
                      <span className="text-xs text-muted-foreground capitalize">
                        {anySub.plan} · {anySub.goal} · {anySub.mealsPerDay}×
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground opacity-40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {c.notes ? (
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-blue-400"
                        title={c.notes}
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <RenewalCell sub={anySub} />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => openOverlay(c.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Modify customer"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
