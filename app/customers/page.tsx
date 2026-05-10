import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips, getAllExtras } from "@/lib/data/subscriptions";
import { getAllPricing } from "@/lib/data/pricing";
import { isSubscriptionLive, subscriptionStatus, formatDate, daysRemaining } from "@/lib/utils/subscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddCustomerForm } from "./add-customer-form";
import { UnifiedCustomerTable } from "./unified-customer-table";
import { EditSubscriptionRow } from "@/app/subscriptions/edit-subscription-row";
import { CustomerOverlayTrigger } from "@/components/customer-overlay-trigger";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const rawSubscriptions = getAllSubscriptions();
  const skips = getAllSkips();
  const allExtras = getAllExtras();
  const pricingEntries = getAllPricing();

  // Build address map: customerId -> sorted addresses (default first)
  const addressesByCustomer = new Map<string, typeof allAddresses>();
  for (const a of allAddresses) {
    const list = addressesByCustomer.get(a.customerId) ?? [];
    list.push(a);
    addressesByCustomer.set(a.customerId, list);
  }
  for (const [, list] of addressesByCustomer) {
    list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }

  // Build skip count map
  const skipCountMap = new Map<string, number>();
  for (const skip of skips) {
    skipCountMap.set(skip.subscriptionId, (skipCountMap.get(skip.subscriptionId) ?? 0) + 1);
  }

  const customerMap = new Map(customers.map((c) => [c.phone, c]));
  const subscriptions = rawSubscriptions.map((s) => ({
    ...s,
    customer: customerMap.get(s.customerId) ?? { id: s.customerId, name: s.customerId, phone: s.customerId, address: "", zone: "", notes: null, createdAt: "" },
    _count: { mealSkips: skipCountMap.get(s.id) ?? 0 },
  }));

  // Build active subs list per customer
  const activeSubsMap = new Map<string, (typeof subscriptions)[number][]>();
  for (const s of subscriptions) {
    if (isSubscriptionLive(s.status, s.startDate, s.endDate)) {
      const list = activeSubsMap.get(s.customer.id) ?? [];
      list.push(s);
      activeSubsMap.set(s.customer.id, list);
    }
  }
  // Sort each customer's active subs by endDate ascending
  for (const list of activeSubsMap.values()) {
    list.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    const aList = activeSubsMap.get(a.id), bList = activeSubsMap.get(b.id);
    const aActive = !!(aList?.length), bActive = !!(bList?.length);
    if (aActive && bActive) {
      // Sort by earliest ending active sub
      return new Date(aList![0].endDate).getTime() - new Date(bList![0].endDate).getTime();
    }
    if (aActive) return -1; if (bActive) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Build unified row data for Tab 1
  const customerRows = sortedCustomers.map((c) => {
    const addresses = addressesByCustomer.get(c.id) ?? [];
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
    const activeSubs = (activeSubsMap.get(c.id) ?? []).map((s) => ({
      plan: s.plan,
      goal: s.goal,
      subscriptionPrice: s.subscriptionPrice,
      shippingPrice: s.shippingPrice,
      endDate: String(s.endDate),
    }));
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      zone: defaultAddr?.zone ?? c.zone,
      addresses: addresses.map((a) => ({ label: a.label, address: a.address, isDefault: a.isDefault })),
      activeSubs,
    };
  });

  const active = subscriptions.filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate));
  const inactive = subscriptions.filter((s) => !isSubscriptionLive(s.status, s.startDate, s.endDate))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function extrasFor(subId: string) {
    return allExtras.filter((e) => e.subscriptionId === subId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} customers · {active.length} active subs
          </p>
        </div>
        <AddCustomerForm />
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">
            Customers
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {customers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive Subs
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {inactive.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <UnifiedCustomerTable rows={customerRows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Customer</th>
                      <th className="text-left px-4 py-2 font-medium">Plan</th>
                      <th className="text-left px-4 py-2 font-medium">Period</th>
                      <th className="text-left px-4 py-2 font-medium">Price</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inactive.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                          No inactive subscriptions.
                        </td>
                      </tr>
                    )}
                    {inactive.map((sub) => {
                      const derivedStatus = subscriptionStatus(sub.status, sub.startDate, sub.endDate);
                      const total = sub.subscriptionPrice + sub.shippingPrice;
                      return (
                        <tr key={sub.id} className="hover:bg-accent/50 transition-colors">
                          <td className="px-4 py-2">
                            <CustomerOverlayTrigger
                              customerId={sub.customer.id}
                              name={sub.customer.name}
                              phone={sub.customer.phone}
                            />
                          </td>
                          <td className="px-4 py-2 capitalize text-muted-foreground">
                            {sub.plan} · {sub.goal} · {sub.mealsPerDay}×/day
                          </td>
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                            {formatDate(sub.startDate)} – {formatDate(sub.endDate)}
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-medium">₫{total.toLocaleString()}</span>
                            {sub.shippingPrice > 0 && (
                              <p className="text-xs text-muted-foreground">
                                sub ₫{sub.subscriptionPrice.toLocaleString()} + ship ₫{sub.shippingPrice.toLocaleString()}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={derivedStatus === "upcoming" ? "secondary" : "outline"}>
                              {derivedStatus}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <EditSubscriptionRow
                              sub={{ ...sub, startDate: String(sub.startDate), endDate: String(sub.endDate) }}
                              pricing={pricingEntries}
                              extras={extrasFor(sub.id)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
