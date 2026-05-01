"use client";

import { useTransition } from "react";
import { skipTodayToNextAction } from "../../actions/skips";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export function SkipTodayButton({ subscriptionId }: { subscriptionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => skipTodayToNextAction(subscriptionId))}
    >
      <Zap size={13} className="mr-1" />
      {pending ? "Skipping…" : "Skip today"}
    </Button>
  );
}
