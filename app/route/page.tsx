import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips, getAllMealDeliveryPlans } from "@/lib/data/subscriptions";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import { getSettings } from "@/lib/data/settings";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import { getSubscriptionDayNotesByWeek } from "@/lib/data/subscription-day-notes";
import { isSubscriptionLive, localDateStr } from "@/lib/utils/subscription";
import { plannedMealsForDate } from "@/lib/utils/schedule";
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
  const mealDeliveryPlans = getAllMealDeliveryPlans();
  const settings = getSettings();

  const dayNum = isoDayOfWeek(selectedDate);
  const weekLabel = weekLabelForDate(selectedDate);
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

  const menuName = (day: number, slot: number): string | null => {
    const m = menuItems.find((it) => it.day === day && it.slot === slot);
    return m?.name ?? null;
  };

  // Build per-sub entries, then group by (customerId, effectiveAddr) same as shipping page
  type SubEntry = {
    sub: typeof subscriptions[number];
    customer: typeof customers[number];
    effectiveAddr: typeof allAddresses[number];
    meals: string[];
  };
  const subEntries: SubEntry[] = [];
  // Deliveries whose effective address has no GPS coordinates — geocoding is
  // compulsory, so we surface these as errors rather than silently dropping them.
  const missingCoords: { name: string; phone: string; address: string }[] = [];

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

    // Resolve the effective address identically to the shipping page: prefer the
    // marked-default address, else fall back to the oldest address on file.
    const customerAddresses = allAddresses
      .filter((a) => a.customerId === customer.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const defaultAddr = customerAddresses.find((a) => a.isDefault) ?? customerAddresses[0];
    const overrideAddrId = dayAddrMap.get(`${sub.id}-${dayNum}`);
    const addrOverride = overrideAddrId ? customerAddresses.find((a) => a.id === overrideAddrId) : null;
    const subDefaultAddr = sub.addressId
      ? customerAddresses.find((a) => a.id === sub.addressId) ?? defaultAddr
      : defaultAddr;
    const effectiveAddr = addrOverride ?? subDefaultAddr;

    const mealCount = plannedMealsForDate(sub, selectedDate, mealDeliveryPlans, skips);
    if (mealCount === 0 && !isReplacement) continue;

    if (!effectiveAddr?.latitude || !effectiveAddr?.longitude) {
      missingCoords.push({
        name: customer.name,
        phone: customer.phone,
        address: effectiveAddr?.address ?? customer.address,
      });
      continue;
    }

    const subSelections = selections
      .filter((sel) => sel.subscriptionId === sub.id && sel.day === dayNum)
      .sort((a, b) => a.mealNum - b.mealNum);

    const meals: string[] = [];
    for (let mealNum = 1; mealNum <= mealCount; mealNum++) {
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

    // Permanent note: customer note + legacy per-customer kitchen note (backward compat),
    // shown once per stop. Matches the shipping page's permanent-note composition.
    const oldKitchenNote = dayNotes.find((n) => n.customerId === customer.phone)?.note ?? null;
    const permanentNote = [customer.notes, oldKitchenNote].filter(Boolean).join(" · ") || null;
    // Day note: concatenate every subscription's day note at this stop, since a stop
    // can carry more than one subscription.
    const dateNote = group
      .map((e) => subDayNotes.find((n) => n.subscriptionId === e.sub.id)?.note)
      .filter(Boolean)
      .join(" · ") || null;

    return {
      id: group[0].sub.id,  // subscription UUID — matches the key used by ShippingTable's manualAssign
      name: customer.name,
      phone: customer.phone,
      address: effectiveAddr.address,
      lat: effectiveAddr.latitude as number,
      lng: effectiveAddr.longitude as number,
      meals,
      permanentNote,
      dateNote,
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
      {missingCoords.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <p className="font-medium text-destructive">
            {missingCoords.length} deliver{missingCoords.length === 1 ? "y is" : "ies are"} missing GPS coordinates and cannot be routed
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set the address coordinates on the Customers page so they appear on the route.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {missingCoords.map((m, i) => (
              <li key={`${m.phone}-${i}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">{m.name}</span> · {m.phone} · {m.address}
              </li>
            ))}
          </ul>
        </div>
      )}
      <RouteMap deliveries={deliveries} date={selectedDateStr} hubLat={settings.hubLat} hubLng={settings.hubLng} />
    </div>
  );
}
