import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import { isSubscriptionLive, localDateStr } from "@/lib/utils/subscription";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import { getSettings } from "@/lib/data/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { weekLabelForDate, weekLabelToDateRange } from "@/lib/utils/week";
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

  const dayNum = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();
  const weekLabel = weekLabelForDate(selectedDate);
  const weekDateRange = weekLabelToDateRange(weekLabel);

  const settings = getSettings();

  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const menuItems = getMenuItemsByWeek(weekLabel);
  const selections = getSelectionsByWeek(weekLabel);
  const dayNotes = getNotesByWeek(weekLabel).filter((n) => n.day === dayNum);
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

  // Build one entry per active-and-not-skipped subscription
  type SubDelivery = {
    sub: typeof subscriptions[number];
    customer: typeof customers[number];
    effectiveAddr: typeof allAddresses[number] | null;
    effectiveAddressId: string | null;
    meals: string[];
    mealSlots: number[];
    isReplacement: boolean;
    customerAddresses: typeof allAddresses;
  };

  const subDeliveries: SubDelivery[] = [];

  for (const sub of subscriptions) {
    if (!isSubscriptionLive(sub.status, sub.startDate, sub.endDate, selectedDate)) continue;

    const customer = customers.find((c) => c.phone === sub.customerId);
    if (!customer) continue;

    const isSkipped = skips.some((skip) =>
      skip.subscriptionId === sub.id &&
      localDateStr(new Date(skip.originalDay + (skip.originalDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
    );
    // Only count a replacement from another day if THIS day is not explicitly skipped.
    // An explicit skip on this day must win over a rescheduled delivery from a different day.
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

    // Effective address: per-day override → sub.addressId → customer default
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

    const meals: string[] = [];
    const mealSlots: number[] = [];
    for (let mealNum = 1; mealNum <= sub.mealsPerDay; mealNum++) {
      const sel = subSelections.find((s) => s.mealNum === mealNum);
      if (sel) {
        const name = menuName(dayNum, sel.menuSlot);
        if (name) meals.push(name);
        mealSlots.push(sel.menuSlot);
      }
    }

    subDeliveries.push({
      sub,
      customer,
      effectiveAddr,
      effectiveAddressId: effectiveAddr?.id ?? null,
      meals,
      mealSlots,
      isReplacement,
      customerAddresses,
    });
  }

  // Group by (customerId, effectiveAddressId) — same customer + same address = one row
  type GroupKey = string;
  const groups = new Map<GroupKey, SubDelivery[]>();
  for (const d of subDeliveries) {
    const key: GroupKey = `${d.customer.id}::${d.effectiveAddressId ?? "none"}`;
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }

  const activeDeliveries = [...groups.values()].map((group) => {
    // Latest-created sub owns the per-day address override UI
    group.sort((a, b) => new Date(b.sub.createdAt).getTime() - new Date(a.sub.createdAt).getTime());
    const latest = group[0];
    const { customer, effectiveAddr, customerAddresses } = latest;
    const defaultAddress = customerAddresses.find((a) => a.isDefault) ?? customerAddresses[0] ?? null;

    const meals = group.flatMap((d) => d.meals);
    const mealSlots = group.flatMap((d) => d.mealSlots);

    return {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: effectiveAddr?.address ?? customer.address,
      zone: effectiveAddr?.zone ?? customer.zone,
      plan: latest.sub.plan,
      mealsPerDay: group.reduce((sum, d) => sum + d.sub.mealsPerDay, 0),
      isReplacement: group.some((d) => d.isReplacement),
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
      effectiveAddressId: latest.effectiveAddressId,
      subscriptionId: latest.sub.id,
      weekLabel,
      day: dayNum,
    };
  });

  const isToday = selectedDateStr === localDateStr(new Date());

  const permanentNotes = customers
    .map((c) => ({ customerId: c.phone, note: c.notes }))
    .filter((n): n is { customerId: string; note: string } => n.note !== null && n.note !== "");

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
            {activeDeliveries.length} deliveries
          </Badge>
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
            notes={dayNotes.map((n) => ({ customerId: n.customerId, note: n.note }))}
            permanentNotes={permanentNotes}
            defaultHub={{ lat: settings.hubLat, lng: settings.hubLng }}
            menuOptionA={menuItems.find((m) => m.day === dayNum && m.slot === 1)?.name ?? null}
            menuOptionB={menuItems.find((m) => m.day === dayNum && m.slot === 2)?.name ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
