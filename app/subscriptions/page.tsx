import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getAllCustomers } from "@/lib/data/customers";
import { getAllPricing } from "@/lib/data/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { planTotalMeals, mealsRemaining, isSubscriptionLive, subscriptionStatus, formatDate } from "@/lib/utils/subscription";
import { UpsertPricingForm } from "./upsert-pricing-form";
import { DeletePricingButton } from "./delete-pricing-button";
import { OpenInFinderButton } from "@/components/open-in-finder-button";
import { NewSubscriptionDialog } from "./new-subscription-dialog";
import { EditSubscriptionRow } from "./edit-subscription-row";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PLANS = ["trial", "weekly", "monthly"];
const GOALS = ["cutting", "maintenance", "bulking"];
const MEALS_PER_DAY = [1, 2];

export default async function SubscriptionsPage() {
  const rawSubscriptions = getAllSubscriptions();
  const customers = getAllCustomers();
  const skips = getAllSkips();
  const pricingEntries = getAllPricing();

  const customerMap = new Map(customers.map((c) => [c.phone, c]));
  const skipCountMap = new Map<string, number>();
  for (const skip of skips) {
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
  const active = subscriptions.filter((s) => isSubscriptionLive(s.status, s.startDate, s.renewalDate));
  const inactive = subscriptions.filter((s) => !isSubscriptionLive(s.status, s.startDate, s.renewalDate));

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
          <NewSubscriptionDialog customers={customers} pricing={pricingEntries} />
          <OpenInFinderButton file="subscriptions.xlsx" />
        </div>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">
            Active
            <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {active.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactive
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
              {inactive.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Customer</th>
                      <th className="text-left px-4 py-2 font-medium">Phone</th>
                      <th className="text-left px-4 py-2 font-medium">Plan</th>
                      <th className="text-left px-4 py-2 font-medium">Goal</th>
                      <th className="text-left px-4 py-2 font-medium">Meals/day</th>
                      <th className="text-left px-4 py-2 font-medium">Start</th>
                      <th className="text-left px-4 py-2 font-medium">End</th>
                      <th className="text-left px-4 py-2 font-medium">Meals left</th>
                      <th className="text-left px-4 py-2 font-medium">Skips</th>
                      <th className="text-left px-4 py-2 font-medium">Price</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {active.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">
                          No active subscriptions.
                        </td>
                      </tr>
                    )}
                    {active.map((sub) => (
                      <tr key={sub.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2">
                          <Link
                            href={`/customers/${sub.customer.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {sub.customer.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{sub.customer.phone}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="capitalize">{sub.plan}</Badge>
                        </td>
                        <td className="px-4 py-2 capitalize">{sub.goal}</td>
                        <td className="px-4 py-2">{sub.mealsPerDay}×</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(sub.startDate)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(sub.renewalDate)}</td>
                        <td className="px-4 py-2 font-medium">{mealsRemaining(sub.renewalDate, sub.mealsPerDay)}</td>
                        <td className="px-4 py-2">{sub._count.mealSkips > 0 ? sub._count.mealSkips : "—"}</td>
                        <td className="px-4 py-2 font-medium">₫{sub.packagePrice.toLocaleString()}</td>
                        <td className="px-2 py-2">
                          <EditSubscriptionRow
                            sub={{ ...sub, startDate: String(sub.startDate), renewalDate: String(sub.renewalDate) }}
                            pricing={pricingEntries}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                      <th className="text-left px-4 py-2 font-medium">Phone</th>
                      <th className="text-left px-4 py-2 font-medium">Plan</th>
                      <th className="text-left px-4 py-2 font-medium">Goal</th>
                      <th className="text-left px-4 py-2 font-medium">Meals/day</th>
                      <th className="text-left px-4 py-2 font-medium">Start</th>
                      <th className="text-left px-4 py-2 font-medium">End</th>
                      <th className="text-left px-4 py-2 font-medium">Skips</th>
                      <th className="text-left px-4 py-2 font-medium">Price</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inactive.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">
                          No inactive subscriptions.
                        </td>
                      </tr>
                    )}
                    {inactive.map((sub) => {
                      const derivedStatus = subscriptionStatus(sub.status, sub.startDate, sub.renewalDate);
                      return (
                      <tr key={sub.id} className="hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2">
                          <Link
                            href={`/customers/${sub.customer.id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {sub.customer.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{sub.customer.phone}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="capitalize">{sub.plan}</Badge>
                        </td>
                        <td className="px-4 py-2 capitalize">{sub.goal}</td>
                        <td className="px-4 py-2">{sub.mealsPerDay}×</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(sub.startDate)}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(sub.renewalDate)}</td>
                        <td className="px-4 py-2">{sub._count.mealSkips > 0 ? sub._count.mealSkips : "—"}</td>
                        <td className="px-4 py-2 font-medium">₫{sub.packagePrice.toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <Badge variant={derivedStatus === "upcoming" ? "secondary" : "outline"}>
                            {derivedStatus}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">
                          <EditSubscriptionRow
                            sub={{ ...sub, startDate: String(sub.startDate), renewalDate: String(sub.renewalDate) }}
                            pricing={pricingEntries}
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
