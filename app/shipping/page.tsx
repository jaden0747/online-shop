import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getNotesByWeek } from "@/lib/data/notes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currentWeekLabel } from "@/lib/utils/week";
import { ShippingTable } from "./shipping-table";

export const dynamic = "force-dynamic";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayDayNumber(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export default async function ShippingPage() {
  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const weekLabel = currentWeekLabel();
  const menuItems = getMenuItemsByWeek(weekLabel);
  const selections = getSelectionsByWeek(weekLabel);
  const today = localDateStr(new Date());
  const dayNum = todayDayNumber();
  const todayNotes = getNotesByWeek(weekLabel).filter((n) => n.day === dayNum);

  // Group addresses by customerId
  const addressesByCustomer = new Map<string, typeof allAddresses>();
  for (const a of allAddresses) {
    const list = addressesByCustomer.get(a.customerId) ?? [];
    list.push(a);
    addressesByCustomer.set(a.customerId, list);
  }

  // Lookup helper: meal name for (day, slot)
  const menuName = (day: number, slot: number): string | null => {
    const m = menuItems.find((it) => it.day === day && it.slot === slot);
    return m?.name ?? null;
  };

  const activeDeliveries = subscriptions
    .filter((s) => isSubscriptionLive(s.status, s.renewalDate) && localDateStr(new Date(s.startDate)) <= today)
    .map((sub) => {
      const customer = customers.find((c) => c.phone === sub.customerId);
      if (!customer) return null;

      const isSkipped = skips.some((skip) => {
        return skip.subscriptionId === sub.id && localDateStr(new Date(skip.originalDay)) === today;
      });
      const isReplacement = skips.some((skip) => {
        return (
          skip.subscriptionId === sub.id &&
          skip.replacementDay !== null &&
          localDateStr(new Date(skip.replacementDay)) === today
        );
      });
      if (isSkipped && !isReplacement) return null;

      // Today's meals: read selections for this customer + today's day-of-week
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

      return {
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        address: defaultAddress?.address ?? customer.address,
        zone: defaultAddress?.zone ?? customer.zone,
        plan: sub.plan,
        mealsPerDay: sub.mealsPerDay,
        isReplacement,
        meals,
        lat: defaultAddress?.latitude ?? null,
        lng: defaultAddress?.longitude ?? null,
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
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shipping</h1>
          <p className="text-sm text-muted-foreground">
            Deliveries for today ({today}) · Week {weekLabel} · Day {dayNum}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {activeDeliveries.length} deliveries
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Deliveries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ShippingTable
            deliveries={activeDeliveries}
            notes={todayNotes.map((n) => ({ customerId: n.customerId, note: n.note }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
