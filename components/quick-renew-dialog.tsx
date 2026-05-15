"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSubscriptionAction } from "@/app/actions/subscriptions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormattedAmountInput } from "@/components/ui/formatted-amount-input";
import { RotateCcw } from "lucide-react";
import { localDateStr } from "@/lib/utils/subscription";

type LastSub = {
  plan: string;
  goal: string;
  mealsPerDay: number;
  subscriptionPrice: number;
  shippingPrice: number;
};

export function QuickRenewDialog({
  customerId,
  customerName,
  lastSub,
}: {
  customerId: string;
  customerName: string;
  lastSub: LastSub;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(localDateStr(new Date()));
  const [subscriptionPrice, setSubscriptionPrice] = useState(lastSub.subscriptionPrice);
  const [shippingPrice, setShippingPrice] = useState(lastSub.shippingPrice);

  function handleOpen(o: boolean) {
    if (o) {
      setStartDate(localDateStr(new Date()));
      setSubscriptionPrice(lastSub.subscriptionPrice);
      setShippingPrice(lastSub.shippingPrice);
    }
    setOpen(o);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("plan", lastSub.plan);
    formData.set("goal", lastSub.goal);
    formData.set("mealsPerDay", String(lastSub.mealsPerDay));
    formData.set("subscriptionPrice", String(subscriptionPrice));
    formData.set("shippingPrice", String(shippingPrice));
    formData.set("startDate", startDate);
    startTransition(async () => {
      await createSubscriptionAction(formData);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      }>
        <RotateCcw size={10} />
        Renew
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew — {customerName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground capitalize">
          {lastSub.plan} · {lastSub.goal} · {lastSub.mealsPerDay}×/day
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subscription (₫)</Label>
              <FormattedAmountInput
                value={subscriptionPrice}
                onChange={(v) => setSubscriptionPrice(Number(v) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Shipping (₫)</Label>
              <FormattedAmountInput
                value={shippingPrice}
                onChange={(v) => setShippingPrice(Number(v) || 0)}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{(subscriptionPrice + shippingPrice).toLocaleString()} VND</span>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending || subscriptionPrice <= 0}>
            {pending ? "Creating…" : "Create Renewal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
