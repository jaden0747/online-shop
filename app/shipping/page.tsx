import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import { getSettings } from "@/lib/data/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { weekLabelForDate, weekLabelToDateRange } from "@/lib/utils/week";
import { DayPicker } from "@/components/day-picker";
import { ShippingTable } from "./shipping-table";

export const dynamic = "force-dynamic";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : null;
  const selectedDateStr = dateParam ?? defaultDateStr();
  // Parse as local midnight to avoid UTC shift on the server
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

  const seenCustomers = new Set<string>();
  const activeDeliveries = subscriptions
    .filter((s) => isSubscriptionLive(s.status, s.startDate, s.renewalDate, selectedDate))
    .map((sub) => {
      const customer = customers.find((c) => c.phone === sub.customerId);
      if (!customer) return null;
      if (seenCustomers.has(customer.id)) return null;
      seenCustomers.add(customer.id);

      const isSkipped = skips.some((skip) => {
        return skip.subscriptionId === sub.id && localDateStr(new Date(skip.originalDay + (skip.originalDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr;
      });
      const isReplacement = skips.some((skip) => {
        return (
          skip.subscriptionId === sub.id &&
          skip.replacementDay !== null &&
          localDateStr(new Date(skip.replacementDay + (skip.replacementDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
        );
      });
      if (isSkipped && !isReplacement) return null;

      const customerSelections = selections
        .filter((sel) => sel.customerId === customer.id && sel.day === dayNum)
        .sort((a, b) => a.mealNum - b.mealNum);

      const meals: string[] = [];
      for (let mealNum = 1; mealNum <= sub.mealsPerDay; mealNum++) {
        const sel = customerSelections.find((s) => s.mealNum === mealNum);
        if (sel) {
          const name = menuName(dayNum, sel.menuSlot);
          if (name) meals.push(name);
        }
      }

      const customerAddresses = (addressesByCustomer.get(customer.id) ?? []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const defaultAddress = customerAddresses.find((a) => a.isDefault) ?? customerAddresses[0] ?? null;

      // Per-day address override
      const overrideAddrId = dayAddrMap.get(`${sub.id}-${dayNum}`);
      const effectiveAddr = overrideAddrId
        ? customerAddresses.find((a) => a.id === overrideAddrId) ?? defaultAddress
        : defaultAddress;

      return {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: effectiveAddr?.address ?? customer.address,
        zone: effectiveAddr?.zone ?? customer.zone,
        plan: sub.plan,
        mealsPerDay: sub.mealsPerDay,
        isReplacement,
        meals,
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
        weekLabel,
        day: dayNum,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

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
          />
        </CardContent>
      </Card>
    </div>
  );
}
