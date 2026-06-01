import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips, getAllMealDeliveryPlans } from "@/lib/data/subscriptions";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import { isSubscriptionLive, localDateStr } from "@/lib/utils/subscription";
import { plannedMealsForDate } from "@/lib/utils/schedule";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import { getSubscriptionDayNotesByWeek } from "@/lib/data/subscription-day-notes";
import { getSettings } from "@/lib/data/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { weekLabelForDate, weekLabelToDateRange, isoDayOfWeek } from "@/lib/utils/week";
import { DayPicker } from "@/components/day-picker";
import { ShippingTable } from "./shipping-table";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function defaultDateStr(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  if (day === 6) {
    now.setDate(now.getDate() + 2); // Sat → Mon
  } else if (day === 0) {
    now.setDate(now.getDate() + 1); // Sun → Mon
  }
  return localDateStr(now);
}

function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime());
}

export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : null;
  const cookieStore = await cookies();
  const cookieDate = cookieStore.get("selected_date")?.value;
  const selectedDateStr = dateParam ?? (cookieDate && isValidDateStr(cookieDate) ? cookieDate : defaultDateStr());
  const selectedDate = new Date(selectedDateStr + "T00:00:00");

  const dayNum = isoDayOfWeek(selectedDate);
  const weekLabel = weekLabelForDate(selectedDate);
  const weekDateRange = weekLabelToDateRange(weekLabel);

  const settings = getSettings();

  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const mealDeliveryPlans = getAllMealDeliveryPlans();
  const menuItems = getMenuItemsByWeek(weekLabel);
  const selections = getSelectionsByWeek(weekLabel);
  const dayNotes = getNotesByWeek(weekLabel).filter((n) => n.day === dayNum);
  const subDayNotes = getSubscriptionDayNotesByWeek(weekLabel).filter((n) => n.day === dayNum);
  const dayAddresses = getAllOrderDayAddresses();

  // Per-day address override lookup: key = `${subscriptionId}-${day}`
  const dayAddrMap = new Map<string, string>();
  for (const da of dayAddresses) {
    if (da.weekLabel === weekLabel) {
      dayAddrMap.set(`${da.subscriptionId}-${da.day}`, da.addressId);
    }
  }

  // Group addresses by customerId
  const addressesByCustomer = new Map<string, typeof allAddresses>();
  for (const a of allAddresses) {
    const list = addressesByCustomer.get(a.customerId) ?? [];
    list.push(a);
    addressesByCustomer.set(a.customerId, list);
  }

  const menuName = (day: number, slot: number): string | null => {
    const m = menuItems.find((it) => it.day === day && it.slot === slot);
    return m?.name ?? null;
  };

  const activeDeliveries: {
    customerId: string;
    name: string;
    phone: string;
    address: string;
    zone: string;
    plan: string;
    mealsPerDay: number;
    isReplacement: boolean;
    meals: string[];
    mealSlots: number[];
    lat: number | null;
    lng: number | null;
    addresses: { id: string; label: string; address: string; zone: string; isDefault: boolean; latitude: number | null; longitude: number | null }[];
    defaultAddressId: string | null;
    effectiveAddressId: string | null;
    subscriptionId: string;
    createdAt: string;
    weekLabel: string;
    day: number;
    permanentNote: string | null;
    subscriptionDayNote: string | null;
  }[] = [];

  for (const sub of subscriptions) {
    if (!isSubscriptionLive(sub.status, sub.startDate, sub.endDate, selectedDate)) continue;

    const customer = customers.find((c) => c.phone === sub.customerId);
    if (!customer) continue;

    const isSkipped = skips.some((skip) =>
      skip.subscriptionId === sub.id &&
      localDateStr(new Date(skip.originalDay + (skip.originalDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
    );
    const isReplacement = !isSkipped && skips.some((skip) =>
      skip.subscriptionId === sub.id &&
      skip.replacementDay !== null &&
      localDateStr(new Date(skip.replacementDay + (skip.replacementDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
    );
    if (isSkipped && !isReplacement) continue;

    const customerAddresses = (addressesByCustomer.get(customer.id) ?? []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const defaultAddress = customerAddresses.find((a) => a.isDefault) ?? customerAddresses[0] ?? null;

    const overrideAddrId = dayAddrMap.get(`${sub.id}-${dayNum}`);
    const subDefaultAddr = sub.addressId
      ? customerAddresses.find((a) => a.id === sub.addressId) ?? defaultAddress
      : defaultAddress;
    const effectiveAddr = overrideAddrId
      ? customerAddresses.find((a) => a.id === overrideAddrId) ?? subDefaultAddr
      : subDefaultAddr;

    const subSelections = selections
      .filter((sel) => sel.subscriptionId === sub.id && sel.day === dayNum)
      .sort((a, b) => a.mealNum - b.mealNum);

    const mealsThisDay = plannedMealsForDate(sub, selectedDate, mealDeliveryPlans, skips);
    if (mealsThisDay === 0 && !isReplacement) continue;

    const meals: string[] = [];
    const mealSlots: number[] = [];
    for (let mealNum = 1; mealNum <= mealsThisDay; mealNum++) {
      const sel = subSelections.find((s) => s.mealNum === mealNum);
      if (sel) {
        const name = menuName(dayNum, sel.menuSlot);
        if (name) meals.push(name);
        mealSlots.push(sel.menuSlot);
      }
    }

    // Permanent note: customer.notes + old kitchen note (backward compat)
    const oldKitchenNote = dayNotes.find((n) => n.customerId === customer.phone)?.note ?? null;
    const permanentNote = [customer.notes, oldKitchenNote].filter(Boolean).join(" · ") || null;

    const subscriptionDayNote = subDayNotes.find((n) => n.subscriptionId === sub.id)?.note ?? null;

    activeDeliveries.push({
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: effectiveAddr?.address ?? customer.address,
      zone: effectiveAddr?.zone ?? customer.zone,
      plan: sub.plan,
      mealsPerDay: mealsThisDay,
      isReplacement,
      meals,
      mealSlots,
      lat: effectiveAddr?.latitude ?? null,
      lng: effectiveAddr?.longitude ?? null,
      addresses: customerAddresses.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        zone: a.zone,
        isDefault: a.isDefault,
        latitude: a.latitude,
        longitude: a.longitude,
      })),
      defaultAddressId: defaultAddress?.id ?? null,
      effectiveAddressId: effectiveAddr?.id ?? null,
      subscriptionId: sub.id,
      createdAt: sub.createdAt,
      weekLabel,
      day: dayNum,
      permanentNote,
      subscriptionDayNote,
    });
  }

  // Stops are deduped by (customer, effective address): two subscriptions delivering
  // to the same place are one stop / one shipper. Only geocoded stops can be routed,
  // matching the route page's stop count.
  const stopKeys = new Set(
    activeDeliveries
      .filter((d) => d.lat !== null && d.lng !== null)
      .map((d) => `${d.customerId}::${d.effectiveAddressId ?? ""}`)
  );
  const stopCount = stopKeys.size;
  const mealCount = activeDeliveries.reduce((sum, d) => sum + d.mealsPerDay, 0);
  const missingCoordCount = activeDeliveries.filter((d) => d.lat === null || d.lng === null).length;

  const isToday = selectedDateStr === localDateStr(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Shipping</h1>
          <p className="text-sm text-muted-foreground">
            {weekDateRange} · Day {dayNum}
            {isToday && " · Today"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DayPicker date={selectedDateStr} />
          <Badge variant="outline" className="text-sm">
            {stopCount} stop{stopCount === 1 ? "" : "s"} · {mealCount} meal{mealCount === 1 ? "" : "s"}
          </Badge>
          {missingCoordCount > 0 && (
            <Badge variant="outline" className="text-sm border-destructive/50 text-destructive">
              {missingCoordCount} need GPS
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliveries for {selectedDateStr}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ShippingTable
            deliveries={activeDeliveries}
            date={selectedDateStr}
            defaultHub={{ lat: settings.hubLat, lng: settings.hubLng }}
            menuOptionA={menuItems.find((m) => m.day === dayNum && m.slot === 1)?.name ?? null}
            menuOptionB={menuItems.find((m) => m.day === dayNum && m.slot === 2)?.name ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
