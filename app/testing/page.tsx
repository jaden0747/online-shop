import { redirect } from "next/navigation";
import { isTestingMode } from "@/lib/data/testing";
import { loadScenarioAction } from "@/app/actions/testing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const SCENARIOS = [
  {
    id: "default" as const,
    name: "Mixed states",
    description: "3 active, 1 expiring in 2 days, 1 paused, 1 cancelled, 2 with no subscription",
  },
  {
    id: "empty" as const,
    name: "Empty",
    description: "No customers or subscriptions",
  },
  {
    id: "expiring-soon" as const,
    name: "Expiring soon",
    description: "4 active subscriptions all expiring within 3 days",
  },
  {
    id: "all-active" as const,
    name: "All active",
    description: "8 active subscriptions, renewal spread 7–30 days",
  },
] as const;

export default function TestingPage() {
  if (!isTestingMode()) redirect("/settings");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Testing Mode</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Load a test scenario to populate synthetic data. Real data is never modified.
        </p>
      </div>

      <div className="grid gap-4">
        {SCENARIOS.map((scenario) => {
          async function loadAction() {
            "use server";
            await loadScenarioAction(scenario.id);
          }

          return (
            <Card key={scenario.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{scenario.name}</CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={loadAction}>
                  <button
                    type="submit"
                    className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Load scenario
                  </button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
