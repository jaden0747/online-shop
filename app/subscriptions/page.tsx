import { getAllSubscriptions, getAllSkips, getAllExtras } from "@/lib/data/subscriptions";
import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllPricing } from "@/lib/data/pricing";
import { getSettings, getMealPrices } from "@/lib/data/settings";
import { getAllPayments } from "@/lib/data/payments";
import { getAllCreditTransactions } from "@/lib/data/credits";
import { subscriptionPaymentStatus } from "@/lib/utils/payments";
import { allCustomerCreditBalances } from "@/lib/utils/credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { planTotalMeals, daysRemaining, isSubscriptionLive } from "@/lib/utils/subscription";
import { UpsertPricingForm } from "./upsert-pricing-form";
import { DeletePricingButton } from "./delete-pricing-button";
import { OpenInFinderButton } from "@/components/open-in-finder-button";
import { NewSubscriptionDialog } from "./new-subscription-dialog";
import { SubscriptionFilters } from "./subscription-filters";
import { parseFilters } from "./subscription-filters-shared";
import { ActiveSubscriptionTable, InactiveSubscriptionTable } from "./subscription-table";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const PLANS = ["trial", "weekly", "monthly"];
const GOALS = ["cutting", "maintenance", "bulking", "keto"];
const MEALS_PER_DAY = [1, 2];

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSubscriptions = getAllSubscriptions();
  const customers = getAllCustomers();
  const allAddresses = getAllAddresses();
  const allSkips = getAllSkips();
  const pricingEntries = getAllPricing();
  const allExtras = getAllExtras();
  const allPayments = getAllPayments();
  const allCreditTransactions = getAllCreditTransactions();
  const creditBalances = allCustomerCreditBalances(allCreditTransactions);
  const settings = getSettings();

  const sp = await searchParams;
  // Build URLSearchParams from the Next.js searchParams record
  const urlSP = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((val) => urlSP.append(k, val));
    else if (v != null) urlSP.set(k, v);
  }
  const filters = parseFilters(urlSP);

  const addressesByCustomer: Record<string, { id: string; label: string; isDefault: boolean }[]> = {};
  for (const a of allAddresses) {
    const list = addressesByCustomer[a.customerId] ?? [];
    list.push({ id: a.id, label: a.label, isDefault: a.isDefault });
    addressesByCustomer[a.customerId] = list;
  }

  const customerMap = new Map(customers.map((c) => [c.phone, c]));
  const skipCountMap = new Map<string, number>();
  for (const skip of allSkips) {
    skipCountMap.set(skip.subscriptionId, (skipCountMap.get(skip.subscriptionId) ?? 0) + 1);
  }

  const subscriptions = rawSubscriptions
    .map((s) => ({
      ...s,
      customer: customerMap.get(s.customerId) ?? { id: s.customerId, name: s.customerId, phone: s.customerId, address: "", zone: "", notes: null, createdAt: "" },
      _count: { mealSkips: skipCountMap.get(s.id) ?? 0 },
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lookup = new Map(
    pricingEntries.map((e) => [`${e.plan}-${e.goal}-${e.mealsPerDay}`, e])
  );

  // Apply filters
  function applyFilters<T extends (typeof subscriptions)[number]>(list: T[]): T[] {
    return list.filter((s) => {
      const q = filters.q.trim().toLowerCase();
      if (q) {
        const name = s.customer.name.toLowerCase();
        const phone = s.customer.phone.toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) return false;
      }
      if (!filters.plans.has(s.plan)) return false;
      if (!filters.goals.has(s.goal)) return false;
      const subSkips = allSkips.filter((sk) => sk.subscriptionId === s.id);
      const payStatus = subscriptionPaymentStatus(s, allPayments, allExtras, subSkips);
      if (!filters.statuses.has(payStatus)) return false;
      if (filters.expiringSoon && daysRemaining(s.endDate) > 7) return false;
      if (filters.from) {
        if (new Date(s.endDate) < new Date(filters.from)) return false;
      }
      if (filters.to) {
        if (new Date(s.startDate) > new Date(filters.to)) return false;
      }
      return true;
    });
  }

  const active = subscriptions.filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate));
  const inactive = subscriptions.filter((s) => !isSubscriptionLive(s.status, s.startDate, s.endDate));
  const filteredActive = applyFilters(active);
  const filteredInactive = applyFilters(inactive);
  const totalFiltered = filteredActive.length + filteredInactive.length;
  const totalAll = subscriptions.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            {subscriptions.length} total · {active.length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewSubscriptionDialog customers={customers} pricing={pricingEntries} allAddresses={allAddresses} mealPrices={getMealPrices(settings)} />
          <OpenInFinderButton file="subscriptions.xlsx" />
        </div>
      </div>

      {/* Filter toolbar */}
      <Suspense fallback={null}>
        <SubscriptionFilters totalCount={totalAll} matchCount={totalFiltered} />
      </Suspense>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">
            Active
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {filteredActive.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {filteredInactive.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <ActiveSubscriptionTable
                  subscriptions={filteredActive}
                  allPayments={allPayments}
                  allExtras={allExtras}
                  allSkips={allSkips}
                  pricingEntries={pricingEntries}
                  addressesByCustomer={addressesByCustomer}
                  creditBalances={creditBalances}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <InactiveSubscriptionTable
                  subscriptions={filteredInactive}
                  allPayments={allPayments}
                  allExtras={allExtras}
                  allSkips={allSkips}
                  pricingEntries={pricingEntries}
                  creditBalances={creditBalances}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Package prices used when creating subscriptions
            </p>
            <UpsertPricingForm />
          </div>

          {PLANS.map((plan) => (
            <Card key={plan} className="mb-4">
              <CardHeader>
                <CardTitle className="text-base capitalize">
                  {plan} plan{" "}
                  <span className="text-muted-foreground font-normal text-sm">
                    ({planTotalMeals(plan)} meals/period)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {GOALS.flatMap((goal) =>
                    MEALS_PER_DAY.map((mpd) => {
                      const key = `${plan}-${goal}-${mpd}`;
                      const entry = lookup.get(key);
                      const totalMeals = planTotalMeals(plan) * mpd;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize w-28 justify-center">
                              {goal}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {mpd}×/day · {totalMeals} meals
                            </span>
                          </div>
                          {entry ? (
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-semibold">
                                  ₫{entry.totalPrice.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  ₫{Math.round(entry.totalPrice / totalMeals).toLocaleString()}/meal
                                </p>
                              </div>
                              <UpsertPricingForm
                                existing={{
                                  plan,
                                  goal,
                                  mealsPerDay: mpd,
                                  totalPrice: entry.totalPrice,
                                }}
                              />
                              <DeletePricingButton id={entry.id} />
                            </div>
                          ) : (
                            <UpsertPricingForm
                              existing={{ plan, goal, mealsPerDay: mpd, totalPrice: 0 }}
                              label="+ Set price"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
