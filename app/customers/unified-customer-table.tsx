"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { daysRemaining } from "@/lib/utils/subscription";
import { Pencil } from "lucide-react";
import { CustomerOverlay } from "@/components/customer-overlay";

type AddressItem = {
  label: string;
  address: string;
  isDefault: boolean;
};

type ActiveSub = {
  plan: string;
  goal: string;
  subscriptionPrice: number;
  shippingPrice: number;
  endDate: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  zone: string;
  addresses: AddressItem[];
  activeSubs: ActiveSub[];
};

function EndDateCell({ endDate }: { endDate: string }) {
  const days = daysRemaining(endDate);
  let textClass = "text-green-600";
  let barClass = "bg-green-500";
  if (days < 3) { textClass = "text-red-600"; barClass = "bg-red-500"; }
  else if (days < 7) { textClass = "text-orange-600"; barClass = "bg-orange-500"; }
  else if (days < 14) { textClass = "text-yellow-600"; barClass = "bg-yellow-500"; }
  const fillPct = Math.min(100, Math.round((days / 14) * 100));
  return (
    <div className="min-w-[70px]">
      <span className={`text-xs font-medium ${textClass}`}>{days}d</span>
      <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
        <div className={`h-1 rounded-full ${barClass}`} style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}

export function UnifiedCustomerTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [overlayId, setOverlayId] = useState<string | null>(null);

  const filtered = search.trim()
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          r.phone.includes(search.trim())
      )
    : rows;

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
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10" />
              <th className="text-left px-4 py-2 font-medium">Customer</th>
              <th className="text-left px-4 py-2 font-medium">Address</th>
              <th className="text-left px-4 py-2 font-medium">Zone</th>
              <th className="text-left px-4 py-2 font-medium">Active Subscriptions</th>
              <th className="text-left px-4 py-2 font-medium w-8">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  {search.trim() ? `No customers matching "${search}"` : "No customers yet."}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setOverlayId(r.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Edit customer"
                  >
                    <Pencil size={14} />
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setOverlayId(r.id)}
                    className="text-left"
                  >
                    <span className="font-medium leading-none block hover:underline">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.phone}</span>
                  </button>
                </td>
                <td className="px-4 py-2 max-w-[220px]">
                  {r.addresses.length === 0 ? (
                    <span className="text-xs text-muted-foreground opacity-40">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {r.addresses.map((a, i) => (
                        <div key={i} className={`text-xs truncate ${a.isDefault ? "font-medium text-foreground" : "text-muted-foreground/60"}`}>
                          {a.address}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {r.zone || <span className="opacity-40">—</span>}
                </td>
                <td className="px-4 py-2">
                  {r.activeSubs.length === 0 ? (
                    <span className="text-xs text-muted-foreground opacity-40">—</span>
                  ) : (
                    <div className="space-y-1">
                      {r.activeSubs.map((s, i) => {
                        const total = s.subscriptionPrice + s.shippingPrice;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs capitalize font-medium">{s.plan}</span>
                            <span className="text-xs text-muted-foreground">· {s.goal} · ₫{total.toLocaleString()}</span>
                            <EndDateCell endDate={s.endDate} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.notes ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-400" title={r.notes} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
