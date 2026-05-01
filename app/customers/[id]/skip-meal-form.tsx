"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createMealSkipAction } from "../../actions/skips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SkipMealForm({
  subscriptionId,
  startDate,
  renewalDate,
}: {
  subscriptionId: string;
  startDate: string;
  renewalDate: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [, action, pending] = useActionState(
    async (_: unknown, formData: FormData) => {
      await createMealSkipAction(formData);
      setOpen(false);
      router.refresh();
      return null;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        + Skip day
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip / Reschedule a Day</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <div className="space-y-1">
            <Label htmlFor="originalDay">Day to skip</Label>
            <Input
              id="originalDay"
              name="originalDay"
              type="date"
              min={startDate}
              max={renewalDate}
              required
            />
            <p className="text-xs text-muted-foreground">
              Past dates allowed for recording historical skips.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="replacementDay">
              Replacement delivery day{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="replacementDay"
              name="replacementDay"
              type="date"
              min={startDate}
              max={renewalDate}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to record a skipped meal. Future skips without a replacement extend the end date.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input id="reason" name="reason" placeholder="e.g. travel, event" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save Skip"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
