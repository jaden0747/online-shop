import { getAllCustomers } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCustomerForm } from "./add-customer-form";
import { ImportCustomersForm } from "./import-customers-form";
import { InlineCustomerTable } from "./inline-customer-table";
import { OpenInFinderButton } from "@/components/open-in-finder-button";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = getAllCustomers().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const subscriptions = getAllSubscriptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" render={<a href="/api/export/customers" download />}>
            <Download size={13} className="mr-1" />
            Export
          </Button>
          <OpenInFinderButton file="customers.xlsx" />
          <ImportCustomersForm />
          <AddCustomerForm />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{customers.length} customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <InlineCustomerTable
            customers={customers}
            subscriptions={subscriptions.map((s) => ({
              customerId: s.customerId,
              plan: s.plan,
              goal: s.goal,
              mealsPerDay: s.mealsPerDay,
              status: s.status,
              startDate: s.startDate,
              renewalDate: s.renewalDate,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
