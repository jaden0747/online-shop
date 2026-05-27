"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_VALUES = ["subscriptions", "inactive", "pricing"] as const;
type SubscriptionPageTab = (typeof TAB_VALUES)[number];

function normalizeTab(value: string | null): SubscriptionPageTab {
  return TAB_VALUES.includes(value as SubscriptionPageTab)
    ? (value as SubscriptionPageTab)
    : "subscriptions";
}

export function SubscriptionPageTabs({
  activeCount,
  inactiveCount,
  subscriptionsContent,
  inactiveContent,
  pricingContent,
}: {
  activeCount: number;
  inactiveCount: number;
  subscriptionsContent: ReactNode;
  inactiveContent: ReactNode;
  pricingContent: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = normalizeTab(searchParams.get("tab"));

  function handleTabChange(value: unknown) {
    const nextTab = normalizeTab(typeof value === "string" ? value : null);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "subscriptions") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="subscriptions">
          Active
          <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {activeCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="inactive">
          Inactive
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
            {inactiveCount}
          </span>
        </TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
      </TabsList>

      <TabsContent value="subscriptions" className="mt-4">
        {subscriptionsContent}
      </TabsContent>

      <TabsContent value="inactive" className="mt-4">
        {inactiveContent}
      </TabsContent>

      <TabsContent value="pricing" className="mt-4 max-w-3xl">
        {pricingContent}
      </TabsContent>
    </Tabs>
  );
}
