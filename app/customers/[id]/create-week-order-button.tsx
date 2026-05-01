"use client";

import { useTransition } from "react";
import { createOrderAction } from "../../actions/orders";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CreateWeekOrderButton({
  subscriptionId,
  weekLabel,
}: {
  subscriptionId: string;
  weekLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("subscriptionId", subscriptionId);
        fd.set("weekLabel", weekLabel);
        startTransition(() => createOrderAction(fd));
      }}
    >
      <Plus size={13} className="mr-1" />
      {pending ? "Creating…" : "Create this week's order"}
    </Button>
  );
}
