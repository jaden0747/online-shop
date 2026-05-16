import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import { getSettings } from "@/lib/data/settings";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import { isSubscriptionLive, localDateStr } from "@/lib/utils/subscription";
import { weekLabelForDate, isoDayOfWeek } from "@/lib/utils/week";
import { DayPicker } from "@/components/day-picker";
import { RouteMap } from "./route-map";
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

export default async function RoutePage({
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

  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const settings = getSettings();

  const dayNum = isoDayOfWeek(selectedDate);
  const weekLabel = weekLabelForDate(selectedDate);
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

  const menuName = (day: number, slot: number): string | null => {
    const m = menuItems.find((it) => it.day === day && it.slot === slot);
    return m?.name ?? null;
  };

  const defaultAddrMap = new Map(
    allAddresses.filter((a) => a.isDefault).map((a) => [a.customerId, a])
  );

  // Build per-sub entries, then group by (customerId, effectiveAddr) same as shipping page
  type SubEntry = {
    sub: typeof subscriptions[number];
    customer: typeof customers[number];
    effectiveAddr: typeof allAddresses[number];
    meals: string[];
  };
  const subEntries: SubEntry[] = [];

  for (const sub of subscriptions) {
    if (!isSubscriptionLive(sub.status, sub.startDate, sub.endDate, selectedDate)) continue;
    const customer = customers.find((c) => c.phone === sub.customerId);
    if (!customer) continue;

    const isSkipped = skips.some(
      (skip) =>
        skip.subscriptionId === sub.id &&
        localDateStr(new Date(skip.originalDay + (skip.originalDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
    );
    // Only count a replacement from another day if THIS day is not explicitly skipped.
    // An explicit skip on this day must win over a rescheduled delivery from a different day.
    const isReplacement = !isSkipped && skips.some(
      (skip) =>
        skip.subscriptionId === sub.id &&
        skip.replacementDay !== null &&
        localDateStr(new Date(skip.replacementDay + (skip.replacementDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
    );
    if (isSkipped && !isReplacement) continue;

    const customerAddresses = allAddresses.filter((a) => a.customerId === customer.id);
    const defaultAddr = defaultAddrMap.get(customer.id);
    const overrideAddrId = dayAddrMap.get(`${sub.id}-${dayNum}`);
    const addrOverride = overrideAddrId ? allAddresses.find((a) => a.id === overrideAddrId) : null;
    const subDefaultAddr = sub.addressId
      ? customerAddresses.find((a) => a.id === sub.addressId) ?? defaultAddr
      : defaultAddr;
    const effectiveAddr = addrOverride ?? subDefaultAddr;
    if (!effectiveAddr?.latitude || !effectiveAddr?.longitude) continue;

    const subSelections = selections
      .filter((sel) => sel.subscriptionId === sub.id && sel.day === dayNum)
      .sort((a, b) => a.mealNum - b.mealNum);

    const meals: string[] = [];
    for (let mealNum = 1; mealNum <= sub.mealsPerDay; mealNum++) {
      const sel = subSelections.find((s) => s.mealNum === mealNum);
      if (sel) {
        const name = menuName(dayNum, sel.menuSlot);
        if (name) meals.push(name);
      }
    }

    subEntries.push({ sub, customer, effectiveAddr: effectiveAddr as typeof allAddresses[number], meals });
  }

  // Group by (customerId, effectiveAddr.id)
  const routeGroups = new Map<string, SubEntry[]>();
  for (const entry of subEntries) {
    const key = `${entry.customer.id}::${entry.effectiveAddr.id}`;
    const list = routeGroups.get(key) ?? [];
    list.push(entry);
    routeGroups.set(key, list);
  }

  const deliveries = [...routeGroups.values()].map((group) => {
    // Sort latest-created sub first — matches shipping page's representative sub selection
    group.sort((a, b) => new Date(b.sub.createdAt).getTime() - new Date(a.sub.createdAt).getTime());
    const { customer, effectiveAddr } = group[0];
    const meals = group.flatMap((e) => e.meals);
    return {
      id: group[0].sub.id,  // subscription UUID — matches the key used by ShippingTable's manualAssign
      name: customer.name,
      phone: customer.phone,
      address: effectiveAddr.address,
      lat: effectiveAddr.latitude as number,
      lng: effectiveAddr.longitude as number,
      meals,
      permanentNote: customer.notes ?? null,
      dateNote: dayNotes.find((n) => n.customerId === customer.phone)?.note ?? null,
    };
  });

  const isToday = selectedDateStr === localDateStr(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Delivery Route</h1>
          <p className="text-sm text-muted-foreground">
            {deliveries.length} stops{isToday ? " · Today" : ""}
          </p>
        </div>
        <DayPicker date={selectedDateStr} />
      </div>
      <RouteMap deliveries={deliveries} date={selectedDateStr} hubLat={settings.hubLat} hubLng={settings.hubLng} />
    </div>
  );
}
