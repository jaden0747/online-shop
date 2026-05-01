import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { RouteMap } from "./route-map";

export const dynamic = "force-dynamic";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function RoutePage() {
  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const today = localDateStr(new Date());

  const defaultAddrMap = new Map(
    allAddresses.filter((a) => a.isDefault).map((a) => [a.customerId, a])
  );

  // Get active deliveries for today that have coordinates
  const deliveries = subscriptions
    .filter((s) => isSubscriptionLive(s.status, s.renewalDate) && localDateStr(new Date(s.startDate)) <= today)
    .map((sub) => {
      const customer = customers.find((c) => c.phone === sub.customerId);
      const defaultAddr = customer ? defaultAddrMap.get(customer.id) : undefined;
      if (!customer || !defaultAddr?.latitude || !defaultAddr?.longitude) return null;

      const isSkipped = skips.some(
        (skip) => skip.subscriptionId === sub.id && localDateStr(new Date(skip.originalDay)) === today
      );
      const isReplacement = skips.some(
        (skip) =>
          skip.subscriptionId === sub.id &&
          skip.replacementDay !== null &&
          localDateStr(new Date(skip.replacementDay)) === today
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delivery Route</h1>
        <p className="text-sm text-muted-foreground">
          Optimal route for today ({today}) · {deliveries.length} stops
        </p>
      </div>
      <RouteMap deliveries={deliveries} />
    </div>
  );
}
