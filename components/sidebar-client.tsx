"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Users, UtensilsCrossed, Truck, MapPin, Map, Settings2, FlaskConical, CreditCard, DollarSign, BarChart3, Clock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover } from "@base-ui/react/popover";
import { useState, useEffect } from "react";
import { getRecentCustomers, type RecentCustomer } from "@/lib/utils/use-recent-customers";
import { CustomerOverlay } from "@/components/customer-overlay";

const baseNav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/costs", label: "Costs", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/shipping", label: "Shipping", icon: Truck },
  { href: "/route", label: "Route", icon: MapPin },
  { href: "/coverage", label: "Coverage Map", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

const testingNavItem = { href: "/testing", label: "Testing", icon: FlaskConical } as const;

function RecentCustomersPopover() {
  const [recent, setRecent] = useState<RecentCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [overlayCustomerId, setOverlayCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRecent(getRecentCustomers().slice(0, 6));
    }
  }, [open]);

  function openOverlay(id: string) {
    setOpen(false);
    setOverlayCustomerId(id);
  }

  return (
    <>
    {overlayCustomerId && (
      <CustomerOverlay
        customerId={overlayCustomerId}
        open={true}
        onOpenChange={(o) => { if (!o) setOverlayCustomerId(null); }}
      />
    )}
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
          open
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        title="Recent customers"
      >
        <Clock size={15} />
        Recent
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6}>
          <Popover.Popup className="z-50 min-w-[220px] rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-lg p-2">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Recently Viewed</p>
            {recent.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No recent customers yet.</p>
            ) : (
              <div className="space-y-0.5">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openOverlay(c.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-1 pt-1 border-t">
              <Link
                href="/customers"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Users size={11} />
                All customers
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
    </>
  );
}

export function SidebarClient({ testingMode }: { testingMode: boolean }) {
  const pathname = usePathname();
  const nav = testingMode ? [...baseNav, testingNavItem] : [...baseNav];

  return (
    <header className="shrink-0 border-b bg-sidebar flex items-center px-3 h-12 gap-1 overflow-x-auto">
      <Link
        href="/"
        className="shrink-0 px-2 mr-1"
        title="Oli Healthy"
      >
        <Image src="/logo.jpg" alt="Oli Healthy" width={32} height={32} className="rounded" />
      </Link>
      <nav className="flex items-center gap-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto shrink-0 flex items-center gap-1">
        <button
          type="button"
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="Search customers (⌘K)"
        >
          <Search size={15} />
          <span className="text-xs opacity-60">⌘K</span>
        </button>
        <RecentCustomersPopover />
      </div>
    </header>
  );
}
