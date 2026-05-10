import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { formatDate } from "@/lib/utils/subscription";

function fmt(d: Date | string | null | undefined) {
  return d ? formatDate(d) : "";
}

export async function GET() {
  const customers = getAllCustomers().sort((a, b) => a.name.localeCompare(b.name));
  const addresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();
  const customerMap = new Map(customers.map((c) => [c.phone, c]));

  const wb = XLSX.utils.book_new();

  // Sheet 1: Customers
  const customerRows = customers.map((c) => {
    const custAddrs = addresses.filter((a) => a.customerId === c.phone);
    return {
      Name: c.name,
      "Phone Number": c.phone,
      "Default Address": c.address,
      Zone: c.zone,
      Notes: c.notes ?? "",
      "Alt Addresses": custAddrs
        .filter((a) => !a.isDefault)
        .map((a) => `${a.label}: ${a.address}`)
        .join("; "),
      "Created At": fmt(c.createdAt),
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(customerRows.length ? customerRows : [{ Note: "No customers" }]),
    "Customers"
  );

  // Sheet 2: All Subscriptions
  const subRows = subscriptions.map((s) => {
    const cust = customerMap.get(s.customerId);
    return {
      Customer: cust?.name ?? s.customerId,
      "Phone Number": s.customerId,
      Plan: s.plan,
      Goal: s.goal,
      "Meals/Day": s.mealsPerDay,
      Status: s.status,
      "Subscription Price": s.subscriptionPrice,
      "Shipping Price": s.shippingPrice,
      "Start Date": fmt(s.startDate),
       "End Date": fmt(s.endDate),
      "Cancel Reason": s.cancelReason ?? "",
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(subRows.length ? subRows : [{ Note: "No subscriptions" }]),
    "Subscriptions"
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="customers-export.xlsx"`,
    },
  });
}
