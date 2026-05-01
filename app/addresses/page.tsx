import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { Card, CardContent } from "@/components/ui/card";
import { OpenInFinderButton } from "@/components/open-in-finder-button";
import { AddressesTable } from "./addresses-table";

export const dynamic = "force-dynamic";

export default function AddressesPage() {
  const customers = getAllCustomers();
  const addresses = getAllAddresses();

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const byCustomer = new Map<string, typeof addresses>();
  for (const a of addresses) {
    const list = byCustomer.get(a.customerId) ?? [];
    list.push(a);
    byCustomer.set(a.customerId, list);
  }

  const rows = customers.flatMap((c) => {
    const addrs = (byCustomer.get(c.id) ?? []).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    return addrs.map((addr, i) => ({
      id: addr.id,
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone,
      label: addr.label,
      address: addr.address,
      zone: addr.zone,
      isDefault: addr.isDefault,
      latitude: addr.latitude,
      longitude: addr.longitude,
      firstForCustomer: i === 0,
    }));
  });

  const totalWithCoords = addresses.filter((a) => a.latitude !== null && a.longitude !== null).length;
  const totalMissing = addresses.length - totalWithCoords;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Addresses</h1>
          <p className="text-sm text-muted-foreground">
            {addresses.length} addresses · {totalWithCoords} with coordinates
            {totalMissing > 0 && ` · ${totalMissing} missing coords`}
          </p>
        </div>
        <OpenInFinderButton file="addresses.xlsx" />
      </div>

      <Card>
        <CardContent className="p-0">
          <AddressesTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
