"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, UtensilsCrossed, ClipboardList, Truck, MapPin, Map, Settings2, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const baseNav = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/shipping", label: "Shipping", icon: Truck },
  { href: "/route", label: "Route", icon: MapPin },
  { href: "/coverage", label: "Coverage Map", icon: Map },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

const testingNavItem = { href: "/testing", label: "Testing", icon: FlaskConical } as const;

export function SidebarClient({ testingMode }: { testingMode: boolean }) {
  const pathname = usePathname();
  const nav = testingMode ? [...baseNav, testingNavItem] : [...baseNav];

  return (
    <aside className="w-14 shrink-0 border-r bg-sidebar h-full sticky top-0 flex flex-col items-center">
      <Link
        href="/"
        className="h-14 w-full flex items-center justify-center border-b font-bold text-lg tracking-tight"
        title="Oli Healthy"
      >
        O
      </Link>
      <nav className="flex-1 w-full py-3 flex flex-col items-center gap-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-md transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
