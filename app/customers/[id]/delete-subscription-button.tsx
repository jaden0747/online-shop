"use client";

import { useTransition } from "react";
import { deleteSubscriptionAction } from "../../actions/subscriptions";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteSubscriptionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Delete this subscription? This will also delete all its orders, meal skips, and selections. This cannot be undone."
          )
        ) {
          startTransition(() => deleteSubscriptionAction(id));
        }
      }}
    >
      <Trash2 size={13} className="mr-1" />
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
