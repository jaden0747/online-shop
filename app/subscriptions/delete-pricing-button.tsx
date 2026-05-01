"use client";

import { useTransition } from "react";
import { deletePricingAction } from "../actions/pricing";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeletePricingButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => deletePricingAction(id))}
    >
      <Trash2 size={14} />
    </Button>
  );
}
