"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { getAllCustomersForSearchAction } from "@/app/actions/customers";
import { CustomerOverlay } from "@/components/customer-overlay";
import { recordRecentCustomer } from "@/lib/utils/use-recent-customers";

type CustomerResult = {
  id: string;
  name: string;
  phone: string;
  zone: string;
  hasActiveSub: boolean;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [overlayCustomerId, setOverlayCustomerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load customers once on first open
  useEffect(() => {
    if (open && !loaded) {
      getAllCustomersForSearchAction().then((data) => {
        setCustomers(data);
        setLoaded(true);
      });
    }
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, loaded]);

  const filtered = query.trim()
    ? customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.phone.includes(query.trim())
        )
        .slice(0, 8)
    : customers.slice(0, 8);

  function select(c: CustomerResult) {
    setOpen(false);
    recordRecentCustomer({ id: c.id, name: c.name, phone: c.phone });
    setOverlayCustomerId(c.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      select(filtered[selectedIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open && !overlayCustomerId) return null;

  return (
    <>
    {overlayCustomerId && (
      <CustomerOverlay
        customerId={overlayCustomerId}
        open={true}
        onOpenChange={(o) => { if (!o) setOverlayCustomerId(null); }}
      />
    )}
    {open && <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-popover rounded-xl shadow-2xl ring-1 ring-foreground/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Search size={15} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search customers by name or phone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
          <kbd className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground text-center">
              {query.trim() ? `No customers matching "${query}"` : "Start typing to search…"}
            </p>
          ) : (
            <div>
              {filtered.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                    i === selectedIdx ? "bg-accent" : "hover:bg-accent/60",
                  ].join(" ")}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.phone}
                      {c.zone ? ` · ${c.zone}` : ""}
                    </span>
                  </div>
                  {c.hasActiveSub && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-medium shrink-0">
                      active
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span><kbd className="bg-muted rounded px-1.5 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="bg-muted rounded px-1.5 py-0.5">↵</kbd> open</span>
          <span><kbd className="bg-muted rounded px-1.5 py-0.5">⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>}
    </>
  );
}
