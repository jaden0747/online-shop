import { getSettings } from "@/lib/data/settings";
import { isTestingMode } from "@/lib/data/testing";
import { getAllPricing } from "@/lib/data/pricing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HubForm } from "./hub-form";
import { TestingToggle } from "./testing-toggle";
import { ImportCustomersForm } from "@/app/customers/import-customers-form";
import { UpsertPricingForm } from "@/app/subscriptions/upsert-pricing-form";
import { DeletePricingButton } from "@/app/subscriptions/delete-pricing-button";
import { planTotalMeals } from "@/lib/utils/subscription";

export const dynamic = "force-dynamic";

const PLANS = ["trial", "weekly", "monthly"];
const GOALS = ["cutting", "maintenance", "bulking"];
const MEALS_PER_DAY = [1, 2];

export default async function SettingsPage() {
  const settings = getSettings();
  const testingActive = isTestingMode();
  const pricingEntries = getAllPricing();
  const lookup = new Map(pricingEntries.map((e) => [`${e.plan}-${e.goal}-${e.mealsPerDay}`, e]));

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Hub Location</CardTitle>
          <CardDescription>
            Used as the origin for route planning and coverage maps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Current: {settings.hubLat.toFixed(6)}, {settings.hubLng.toFixed(6)}
          </div>
          <HubForm hubLat={settings.hubLat} hubLng={settings.hubLng} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testing Mode</CardTitle>
          <CardDescription>Switch to synthetic data. Real data is untouched.</CardDescription>
        </CardHeader>
        <CardContent>
          <TestingToggle isActive={testingActive} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Customers</CardTitle>
          <CardDescription>
            Bulk-import customers from a CSV file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportCustomersForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pricing Matrix</CardTitle>
              <CardDescription className="mt-1">
                Package prices used when creating subscriptions.
              </CardDescription>
            </div>
            <UpsertPricingForm />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {PLANS.map((plan) => (
            <div key={plan} className="border-t first:border-t-0">
              <div className="px-4 py-2 bg-muted/40 font-medium text-sm capitalize">
                {plan} plan{" "}
                <span className="text-muted-foreground font-normal">
                  ({planTotalMeals(plan)} meals/period)
                </span>
              </div>
              <div className="divide-y">
                {GOALS.flatMap((goal) =>
                  MEALS_PER_DAY.map((mpd) => {
                    const key = `${plan}-${goal}-${mpd}`;
                    const entry = lookup.get(key);
                    const totalMeals = planTotalMeals(plan) * mpd;
                    return (
                      <div key={key} className="flex items-center justify-between px-4 py-3">
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
                              <p className="text-sm font-semibold">₫{entry.totalPrice.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">
                                ₫{Math.round(entry.totalPrice / totalMeals).toLocaleString()}/meal
                              </p>
                            </div>
                            <UpsertPricingForm existing={{ plan, goal, mealsPerDay: mpd, totalPrice: entry.totalPrice }} />
                            <DeletePricingButton id={entry.id} />
                          </div>
                        ) : (
                          <UpsertPricingForm existing={{ plan, goal, mealsPerDay: mpd, totalPrice: 0 }} label="+ Set price" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
