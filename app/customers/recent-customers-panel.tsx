"use client";

import { useState, useEffect } from "react";
import { Clock, UserPlus } from "lucide-react";
import { getRecentCustomers, type RecentCustomer } from "@/lib/utils/use-recent-customers";

type NewCustomer = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
};

export function RecentCustomersPanel({
  recentlyCreated,
  onOpenCustomer,
}: {
  recentlyCreated: NewCustomer[];
  onOpenCustomer: (id: string) => void;
}) {
  const [recentViewed, setRecentViewed] = useState<RecentCustomer[]>([]);

  useEffect(() => {
    setRecentViewed(getRecentCustomers().slice(0, 6));
  }, []);

  if (recentViewed.length === 0 && recentlyCreated.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 px-4 py-3 border-b bg-muted/30">
      {recentViewed.length > 0 && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
            <Clock size={11} />
            Recently Viewed
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentViewed.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenCustomer(c.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border text-xs hover:border-primary/50 hover:bg-accent transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentlyCreated.length > 0 && (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
            <UserPlus size={11} />
            Newest Customers
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentlyCreated.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpenCustomer(c.id)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border text-xs hover:border-primary/50 hover:bg-accent transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
