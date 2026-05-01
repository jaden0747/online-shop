"use client";

import { useTransition } from "react";
import { deleteMealSkipAction } from "../../actions/skips";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function DeleteSkipButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 w-5 p-0"
      disabled={pending}
      onClick={() => startTransition(() => deleteMealSkipAction(id))}
    >
      <X size={12} />
    </Button>
  );
}
