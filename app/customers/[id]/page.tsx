import { getCustomerById, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getAllPricing } from "@/lib/data/pricing";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getOrdersBySubscription, getItemsByOrder } from "@/lib/data/orders";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddSubscriptionForm } from "./add-subscription-form";
import { SubscriptionStatusButton } from "./subscription-status-button";
import { SkipMealForm } from "./skip-meal-form";
import { DeleteSkipButton } from "./delete-skip-button";
import { EditCustomerForm } from "./edit-customer-form";
import { ManageAddresses } from "./manage-addresses";
import { SkipTodayButton } from "./skip-today-button";
import { SubscriptionCalendar } from "./subscription-calendar";
import { EditSubscriptionForm } from "./edit-subscription-form";
import { DeleteSubscriptionButton } from "./delete-subscription-button";
import { CreateWeekOrderButton } from "./create-week-order-button";
import { MealSelector } from "@/components/meal-selector";
import { daysRemaining, mealsRemaining, isSubscriptionLive, subscriptionStatus, formatDate } from "@/lib/utils/subscription";
import { currentWeekLabel, currentWeekMonday, formatWeekLabel } from "@/lib/utils/week";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phone = decodeURIComponent(id);
  const weekLabel = currentWeekLabel();
  const weekMonday = currentWeekMonday();

  const customer = getCustomerById(phone);
  if (!customer) notFound();

  const addresses = getAllAddresses().filter((a) => a.customerId === phone).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const pricing = getAllPricing().sort((a, b) => a.plan.localeCompare(b.plan));
  const menuItems = getMenuItemsByWeek(weekLabel);

  const allSubs = getAllSubscriptions().filter((s) => s.customerId === phone).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const allSkips = getAllSkips();

  // Enrich subscriptions with orders and skips
  const subscriptions = allSubs.map((s) => {
    const orders = getOrdersBySubscription(s.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o) => ({ ...o, items: getItemsByOrder(o.id) }));
    const mealSkips = allSkips
      .filter((sk) => sk.subscriptionId === s.id)
      .sort((a, b) => new Date(a.originalDay).getTime() - new Date(b.originalDay).getTime());
    return { ...s, orders, mealSkips };
  });

  // Compute per-subscription derived data
  const subData = subscriptions.map((sub) => {
    const isActive = isSubscriptionLive(sub.status, sub.startDate, sub.renewalDate);
    const derivedStatus = subscriptionStatus(sub.status, sub.startDate, sub.renewalDate);
    const currentWeekOrder = sub.orders.find((o) => o.weekLabel === weekLabel) ?? null;

    let allowedDays: number[] | null = null;
    let skippedDayNums: number[] = [];

    if (isActive) {
      const subStart = new Date(sub.startDate);
      subStart.setHours(0, 0, 0, 0);
      const subEnd = new Date(sub.renewalDate);
      subEnd.setHours(0, 0, 0, 0);

      const inPeriodDays: number[] = [];
      for (let i = 0; i < 5; i++) {
        const dayDate = new Date(weekMonday);
        dayDate.setDate(weekMonday.getDate() + i);
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate >= subStart && dayDate <= subEnd) inPeriodDays.push(i + 1);
      }
      for (const dayNum of inPeriodDays) {
        const dayDate = new Date(weekMonday);
        dayDate.setDate(weekMonday.getDate() + dayNum - 1);
        dayDate.setHours(0, 0, 0, 0);
        const isSkipped = sub.mealSkips.some((skip) => {
          const s = new Date(skip.originalDay);
          s.setHours(0, 0, 0, 0);
          return s.getTime() === dayDate.getTime();
        });
        if (isSkipped) skippedDayNums.push(dayNum);
      }
      allowedDays = inPeriodDays.length < 5 ? inPeriodDays : null;
    }

    const deliveredCount = sub.orders.filter((o) => o.status === "delivered").length;
    return { ...sub, isActive, derivedStatus, currentWeekOrder, allowedDays, skippedDayNums, deliveredCount };
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone} · {customer.address} · {customer.zone}
          </p>
          {customer.notes && (
            <p className="text-sm text-muted-foreground mt-1">{customer.notes}</p>
          )}
        </div>
        <EditCustomerForm customer={customer} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Delivery Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <ManageAddresses customerId={customer.id} addresses={addresses} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Subscriptions</h2>
        <AddSubscriptionForm customerId={customer.id} pricing={pricing} />
      </div>

      {subData.length === 0 && (
        <p className="text-sm text-muted-foreground">No subscription yet.</p>
      )}

      {subData.map((sub) => (
        <Card key={sub.id}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base capitalize">{sub.plan} plan</CardTitle>
              <Badge
                variant={
                  sub.isActive ? "default" : sub.derivedStatus === "upcoming" ? "secondary" : "outline"
                }
              >
                {sub.derivedStatus}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <EditSubscriptionForm sub={sub} pricing={pricing} />
              <DeleteSubscriptionButton id={sub.id} />
              <SubscriptionStatusButton
                subscriptionId={sub.id}
                currentStatus={sub.status}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Goal: </span>
                <span className="capitalize">{sub.goal}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Meals/day: </span>
                <span>{sub.mealsPerDay}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Start: </span>
                <span>{formatDate(sub.startDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">End: </span>
                <span>{formatDate(sub.renewalDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Package price: </span>
                <span className="font-medium">₫{sub.packagePrice.toLocaleString()}</span>
              </div>
            </div>

            {(sub.isActive || sub.derivedStatus === "expired") && (
              <div className="flex gap-4 rounded-lg bg-muted/50 p-3">
                <div className="text-center flex-1">
                  <p className="text-xl font-bold">
                    {mealsRemaining(sub.renewalDate, sub.mealsPerDay)}
                  </p>
                  <p className="text-xs text-muted-foreground">meals left</p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center flex-1">
                  <p className="text-xl font-bold">{daysRemaining(sub.renewalDate)}</p>
                  <p className="text-xs text-muted-foreground">days to end</p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center flex-1">
                  <p className="text-xl font-bold">{sub.deliveredCount}</p>
                  <p className="text-xs text-muted-foreground">delivered</p>
                </div>
              </div>
            )}

            {/* Schedule calendar */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Schedule</p>
              <SubscriptionCalendar
                subscriptionId={sub.id}
                startDate={sub.startDate}
                endDate={sub.renewalDate}
                skips={sub.mealSkips.map((s) => ({ id: s.id, originalDay: s.originalDay }))}
              />
            </div>

            {/* This week's meals */}
            {sub.isActive && (
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {formatWeekLabel(weekLabel)} — Meals
                  </p>
                  {sub.currentWeekOrder ? (
                    <MealSelector
                      orderId={sub.currentWeekOrder.id}
                      menuItems={menuItems}
                      existingSelections={sub.currentWeekOrder.items.map((i) => ({
                        day: i.day,
                        mealSlot: i.mealSlot,
                        menuItemId: i.menuItemId,
                        quantity: i.quantity,
                        notes: i.notes,
                      }))}
                      allowedDays={sub.allowedDays}
                      skippedDays={sub.skippedDayNums}
                      mealsPerDay={sub.mealsPerDay}
                      selectionCount={sub.currentWeekOrder.items.length}
                      addresses={addresses}
                      currentAddressId={sub.currentWeekOrder.addressId ?? null}
                    />
                  ) : (
                    <CreateWeekOrderButton
                      subscriptionId={sub.id}
                      weekLabel={weekLabel}
                    />
                  )}
                </div>

                {/* Day-by-day summary */}
                <div className="grid grid-cols-5 gap-1 text-center text-xs">
                  {[1, 2, 3, 4, 5].map((dayNum) => {
                    const dayDate = new Date(weekMonday);
                    dayDate.setDate(weekMonday.getDate() + dayNum - 1);
                    dayDate.setHours(0, 0, 0, 0);
                    const subStart = new Date(sub.startDate); subStart.setHours(0, 0, 0, 0);
                    const subEnd = new Date(sub.renewalDate); subEnd.setHours(0, 0, 0, 0);
                    const inPeriod = dayDate >= subStart && dayDate <= subEnd;
                    const isSkipped = sub.skippedDayNums.includes(dayNum);

                    let content: React.ReactNode;
                    if (!inPeriod) {
                      content = <span className="text-muted-foreground/40">—</span>;
                    } else if (isSkipped) {
                      content = <span className="text-amber-600">Skip</span>;
                    } else if (!sub.currentWeekOrder) {
                      content = <span className="text-muted-foreground">—</span>;
                    } else {
                      const items = sub.currentWeekOrder.items.filter((i) => i.day === dayNum);
                      if (items.length === 0) {
                        content = <span className="text-muted-foreground">—</span>;
                      } else {
                        const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));
                        const names = items.map((i) =>
                          i.menuItemId ? (menuMap.get(i.menuItemId) ?? "?") : (i.notes ?? "custom")
                        );
                        content = <span className="truncate text-foreground">{names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}</span>;
                      }
                    }
                    return (
                      <div key={dayNum} className="space-y-0.5">
                        <p className="font-medium text-muted-foreground">{DAY_NAMES[dayNum - 1]}</p>
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skips / Reschedules */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Skips / Reschedules
                </p>
                <div className="flex items-center gap-2">
                  {sub.isActive && <SkipTodayButton subscriptionId={sub.id} />}
                  <SkipMealForm
                    subscriptionId={sub.id}
                    startDate={new Date(sub.startDate).toISOString().split("T")[0]}
                    renewalDate={new Date(sub.renewalDate).toISOString().split("T")[0]}
                  />
                </div>
              </div>
              {sub.mealSkips.length === 0 && (
                <p className="text-xs text-muted-foreground">No skips recorded.</p>
              )}
              {sub.mealSkips.map((skip) => (
                <div key={skip.id} className="flex items-center justify-between text-xs">
                  <span>
                    Skip {formatDate(skip.originalDay)}
                    {skip.replacementDay && (
                      <span className="text-muted-foreground"> → deliver {formatDate(skip.replacementDay)}</span>
                    )}
                    {!skip.replacementDay && (
                      <span className="text-muted-foreground"> (no replacement)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {skip.reason && <span className="text-muted-foreground">{skip.reason}</span>}
                    <DeleteSkipButton id={skip.id} />
                  </div>
                </div>
              ))}
            </div>

            {sub.orders.length > 0 && (
              <div className="border-t pt-3 space-y-1">
                <p className="text-xs text-muted-foreground mb-1">Recent orders</p>
                {sub.orders.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex justify-between text-xs">
                    <span>{o.weekLabel}</span>
                    <Badge variant="outline" className="text-xs">{o.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
