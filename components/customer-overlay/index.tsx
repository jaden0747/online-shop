"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  getCustomerDetailsAction,
  updateCustomerNoteAction,
} from "@/app/actions/customers";
import dynamic from "next/dynamic";
const CustomerMinimap = dynamic(
  () => import("../customer-minimap").then((m) => m.CustomerMinimap),
  { ssr: false }
);
import type { CustomerAddress, Subscription, Payment, CreditTransaction } from "@/lib/data/types";
import type { Details, RouteMap } from "./types";
import type { SectionRef } from "./section-ref";
import { FinancialSummary } from "./financial-summary";
import { CustomerHeader } from "./customer-header";
import { CustomerNote } from "./customer-note";
import { AddressSection } from "./address-section";
import { SubscriptionSection } from "./subscription-section";
import { CreditPanel } from "./credit-panel";
import { SchedulePanel } from "./schedule-panel";

export function CustomerOverlay({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [currentId, setCurrentId] = useState(customerId);
  const [isPending, startTransition] = useTransition();
  const prevOpenRef = useRef(false);
  const [routes, setRoutes] = useState<RouteMap>(new Map());
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [activeTab, setActiveTab] = useState<"customer" | "calendar">("customer");

  const headerRef = useRef<SectionRef>(null);
  const addrRef = useRef<SectionRef>(null);
  const subRef = useRef<SectionRef>(null);

  const load = useCallback((id: string, clearFirst = true) => {
    if (clearFirst) {
      setDetails(null);
      setRoutes(new Map());
    }
    getCustomerDetailsAction(id).then((d) => {
      setDetails(d);
      setNoteValue(d.customer?.notes ?? "");
    });
  }, []);

  const reload = useCallback(
    (id?: string) => {
      load(id ?? currentId, false);
    },
    [currentId, load]
  );

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCurrentId(customerId);
      headerRef.current?.reset();
      addrRef.current?.reset();
      subRef.current?.reset();
      setActiveTab("customer");
      load(customerId);
    }
    prevOpenRef.current = open;
  }, [open, customerId, load]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (headerRef.current?.closeOpenForm()) return;
      if (addrRef.current?.closeOpenForm()) return;
      if (subRef.current?.closeOpenForm()) return;
      onOpenChange(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const handlePaymentCreated = useCallback((payment: Payment) => {
    setDetails((prev) =>
      prev ? { ...prev, payments: [...prev.payments, payment] } : prev
    );
  }, []);

  const handlePaymentDeleted = useCallback((paymentId: string) => {
    setDetails((prev) =>
      prev
        ? { ...prev, payments: prev.payments.filter((p) => p.id !== paymentId) }
        : prev
    );
  }, []);

  const handleSubscriptionCancelled = useCallback(
    (result?: {
      subscription: Subscription | null;
      payment?: Payment;
      creditTransaction?: CreditTransaction;
    }) => {
      if (!result?.subscription) {
        reload();
        return;
      }
      setDetails((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          subscriptions: prev.subscriptions.map((s) =>
            s.id === result.subscription!.id ? result.subscription! : s
          ),
          payments: result.payment
            ? [...prev.payments, result.payment]
            : prev.payments,
          creditTransactions: result.creditTransaction
            ? [...prev.creditTransactions, result.creditTransaction]
            : prev.creditTransactions,
        };
      });
    },
    [reload]
  );

  // Stable keys prevent route re-fetch on unrelated setDetails calls
  const hubKey = details?.hub ? `${details.hub.lat},${details.hub.lng}` : null;
  const addrKey =
    details?.addresses
      .filter((a) => a.latitude != null && a.longitude != null)
      .map((a) => a.id)
      .join(",") ?? "";

  useEffect(() => {
    if (!details?.hub || !addrKey) return;
    const addressesWithCoords = details.addresses.filter(
      (a) => a.latitude != null && a.longitude != null
    );
    if (addressesWithCoords.length === 0) return;

    const controller = new AbortController();
    const { signal } = controller;
    setLoadingRoutes(true);
    const hub = details.hub;

    const fetchRoute = async (addr: CustomerAddress) => {
      try {
        const res = await fetch("/api/route-geometry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            waypoints: [
              { lat: hub.lat, lng: hub.lng },
              { lat: addr.latitude!, lng: addr.longitude! },
            ],
          }),
          signal,
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.positions) return { addrId: addr.id, data };
      } catch {
        /* includes AbortError */
      }
      return null;
    };

    Promise.all(addressesWithCoords.map(fetchRoute)).then((results) => {
      if (signal.aborted) return;
      setRoutes(() => {
        const newRoutes = new Map<
          string,
          { positions: [number, number][]; distance: number; duration: number }
        >();
        results.forEach((result) => {
          if (result) {
            newRoutes.set(result.addrId, {
              positions: result.data.positions,
              distance: result.data.distance ?? 0,
              duration: result.data.duration ?? 0,
            });
          }
        });
        return newRoutes;
      });
      setLoadingRoutes(false);
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubKey, addrKey]);

  function handleNoteBlur() {
    if (!details?.customer) return;
    const notes = noteValue.trim() || null;
    if (notes === (details.customer.notes ?? null)) return;
    startTransition(async () => {
      await updateCustomerNoteAction(currentId, notes);
      setDetails((p) =>
        p?.customer ? { ...p, customer: { ...p.customer, notes } } : p
      );
    });
  }

  const minimap = useMemo(() => {
    if (!details) return null;
    return (
      <CustomerMinimap
        addresses={details.addresses}
        hub={details.hub}
        routes={routes}
        loading={loadingRoutes}
      />
    );
  }, [details?.addresses, details?.hub, routes, loadingRoutes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        showOverlay={false}
        className="top-[calc(50%+1.5rem)] sm:w-[62vw] sm:max-w-[62vw] h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        {!details ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : details.customer === null ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Customer not found.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="sticky top-0 z-20 -mx-6 -mt-6 border-b bg-background/95 px-6 pt-6 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <DialogHeader>
                <CustomerHeader
                  ref={headerRef}
                  customer={details.customer}
                  customerId={currentId}
                  onSaved={(newId) => {
                    setCurrentId(newId);
                    reload(newId);
                  }}
                  externalUserId={details.externalUserId}
                  handoffActive={details.handoffActive}
                />
              </DialogHeader>

              <div className="mt-3 flex gap-1 border-b">
                {[
                  ["customer", "Customer"],
                  ["calendar", "Calendar"],
                ].map(([key, label]) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key as "customer" | "calendar")}
                      className={[
                        "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                        active
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === "customer" ? (
              <>
                <CustomerNote
                  value={noteValue}
                  onChange={setNoteValue}
                  onBlur={handleNoteBlur}
                  isSaving={isPending}
                />
                <FinancialSummary details={details} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-1">
                  <div className="space-y-4">
                    <AddressSection
                      ref={addrRef}
                      addresses={details.addresses}
                      customerId={currentId}
                      routes={routes}
                      loadingRoutes={loadingRoutes}
                      onReload={reload}
                    />
                    {minimap}
                  </div>

                  <div className="space-y-4">
                    <SubscriptionSection
                      ref={subRef}
                      subscriptions={details.subscriptions}
                      customerId={currentId}
                      creditTransactions={details.creditTransactions}
                      pricing={details.pricing}
                      mealPrices={details.mealPrices}
                      skips={details.skips}
                      skipCounts={details.skipCounts}
                      payments={details.payments}
                      extras={details.extras}
                      onPaymentCreated={handlePaymentCreated}
                      onPaymentDeleted={handlePaymentDeleted}
                      onSubscriptionCancelled={handleSubscriptionCancelled}
                      onReload={reload}
                    />
                    <CreditPanel
                      customerId={currentId}
                      creditTransactions={details.creditTransactions}
                      subscriptions={details.subscriptions}
                      onReload={reload}
                    />
                  </div>
                </div>
              </>
            ) : (
              <SchedulePanel
                subscriptions={details.subscriptions}
                addresses={details.addresses}
                skips={details.skips}
                allSelections={details.allSelections}
                mealDeliveryPlans={details.mealDeliveryPlans}
                allMenuItems={details.allMenuItems}
                subscriptionDayNotes={details.subscriptionDayNotes}
                dayAddresses={details.dayAddresses}
                customerNote={noteValue}
                customerId={currentId}
                onReload={reload}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
