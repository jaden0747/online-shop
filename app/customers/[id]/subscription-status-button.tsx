"use client";

import { useTransition } from "react";
import { updateSubscriptionStatusAction } from "../../actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SubscriptionStatusButton({
  subscriptionId,
  currentStatus,
}: {
  subscriptionId: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      defaultValue={currentStatus}
      disabled={pending}
      onValueChange={(val) =>
        val && startTransition(() => updateSubscriptionStatusAction(subscriptionId, val))
      }
    >
      <SelectTrigger className="w-28 h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active" className="text-xs">active</SelectItem>
        <SelectItem value="paused" className="text-xs">paused</SelectItem>
        <SelectItem value="cancelled" className="text-xs">cancelled</SelectItem>
      </SelectContent>
    </Select>
  );
}
