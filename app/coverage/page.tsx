import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { CoverageMap } from "./coverage-map";

export const dynamic = "force-dynamic";

export default function CoveragePage() {
  const customers = getAllCustomers();
  const addresses = getAllAddresses();

  const defaultAddrMap = new Map(
    addresses
      .filter((a) => a.isDefault && a.latitude !== null && a.longitude !== null)
      .map((a) => [a.customerId, a])
  );

  const pins = customers
    .map((c) => {
      const addr = defaultAddrMap.get(c.id);
      if (!addr) return null;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: addr.address,
        zone: addr.zone,
        lat: addr.latitude as number,
        lng: addr.longitude as number,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const missing = customers.length - pins.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Coverage Map</h1>
        <p className="text-sm text-muted-foreground">
          {pins.length} customers mapped
          {missing > 0 ? ` · ${missing} without coordinates` : ""}
        </p>
      </div>
      <CoverageMap pins={pins} />
    </div>
  );
}
