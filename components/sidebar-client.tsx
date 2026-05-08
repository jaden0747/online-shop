"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, UtensilsCrossed, Truck, MapPin, Map, Settings2, FlaskConical } from "lucide-react";
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
    <header className="shrink-0 border-b bg-sidebar flex items-center px-3 h-12 gap-1 overflow-x-auto">
      <Link
        href="/"
        className="shrink-0 font-bold text-base tracking-tight px-2 mr-1"
        title="Oli Healthy"
      >
        Oli
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
    </header>
  );
}
