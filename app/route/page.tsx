import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getSettings } from "@/lib/data/settings";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { DayPicker } from "@/components/day-picker";
import { RouteMap } from "./route-map";

export const dynamic = "force-dynamic";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

export default async function RoutePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : null;
  const selectedDateStr = dateParam ?? todayStr();
  const selectedDate = new Date(selectedDateStr + "T00:00:00");

  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const settings = getSettings();

  const defaultAddrMap = new Map(
    allAddresses.filter((a) => a.isDefault).map((a) => [a.customerId, a])
  );

  const seenCustomers = new Set<string>();
  const deliveries = subscriptions
    .filter((s) => isSubscriptionLive(s.status, s.startDate, s.renewalDate, selectedDate))
    .map((sub) => {
      const customer = customers.find((c) => c.phone === sub.customerId);
      const defaultAddr = customer ? defaultAddrMap.get(customer.id) : undefined;
      if (!customer || !defaultAddr?.latitude || !defaultAddr?.longitude) return null;
      if (seenCustomers.has(customer.id)) return null;
      seenCustomers.add(customer.id);

      const isSkipped = skips.some(
        (skip) =>
          skip.subscriptionId === sub.id &&
          localDateStr(new Date(skip.originalDay + (skip.originalDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
      );
      const isReplacement = skips.some(
        (skip) =>
          skip.subscriptionId === sub.id &&
          skip.replacementDay !== null &&
          localDateStr(new Date(skip.replacementDay + (skip.replacementDay.length === 10 ? "T00:00:00" : ""))) === selectedDateStr
      );
      if (isSkipped && !isReplacement) return null;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: defaultAddr.address,
        lat: defaultAddr.latitude as number,
        lng: defaultAddr.longitude as number,
      };
    })
    .filter(Boolean) as { id: string; name: string; phone: string; address: string; lat: number; lng: number }[];

  const isToday = selectedDateStr === todayStr();

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
