import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { getAllOrders, getAllOrderItems } from "@/lib/data/orders";
import { getAllMenuItems } from "@/lib/data/menu";
import { currentWeekLabel, formatWeekLabel } from "@/lib/utils/week";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") || currentWeekLabel();

  const orders = getAllOrders().filter((o) => o.weekLabel === week);
  const orderIds = new Set(orders.map((o) => o.id));
  const allItems = getAllOrderItems().filter((it) => orderIds.has(it.orderId));
  const allMenuItems = getAllMenuItems();
  const customers = getAllCustomers();
  const addresses = getAllAddresses();
  const subscriptions = getAllSubscriptions();

  const custMap = new Map(customers.map((c) => [c.phone, c]));
  const subMap = new Map(subscriptions.map((s) => [s.id, s]));
  const addrMap = new Map(addresses.map((a) => [a.id, a]));
  const menuMap = new Map(allMenuItems.map((m) => [m.id, m]));

  // Sort orders by zone then createdAt
  orders.sort((a, b) => {
    const sub_a = subMap.get(a.subscriptionId);
    const sub_b = subMap.get(b.subscriptionId);
    const cust_a = custMap.get(sub_a?.customerId ?? "");
    const cust_b = custMap.get(sub_b?.customerId ?? "");
    const zoneCompare = (cust_a?.zone ?? "").localeCompare(cust_b?.zone ?? "");
    if (zoneCompare !== 0) return zoneCompare;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Orders summary
  const orderRows = orders.map((o) => {
    const sub = subMap.get(o.subscriptionId);
    const cust = custMap.get(sub?.customerId ?? "");
    const addr = addrMap.get(o.addressId ?? "");
    const items = allItems.filter((it) => it.orderId === o.id);
    const meals: Record<string, string> = {};
    for (let d = 1; d <= 5; d++) {
      const dayItems = items.filter((it) => it.day === d);
      meals[DAY_NAMES[d]] = dayItems.length === 0
        ? ""
        : dayItems.map((it) => {
            const mi = menuMap.get(it.menuItemId ?? "");
            return mi ? `${mi.name} ×${it.quantity}` : it.notes ?? "custom";
          }).join(", ");
    }
    return {
      Customer: cust?.name ?? sub?.customerId ?? "",
      Phone: cust?.phone ?? "",
      Zone: cust?.zone ?? "",
      Plan: sub?.plan ?? "",
      Goal: sub?.goal ?? "",
      "Meals/Day": sub?.mealsPerDay ?? "",
      Status: o.status,
      "Delivery Address": addr?.address ?? cust?.address ?? "",
      Monday: meals["Monday"],
      Tuesday: meals["Tuesday"],
      Wednesday: meals["Wednesday"],
      Thursday: meals["Thursday"],
      Friday: meals["Friday"],
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(orderRows.length ? orderRows : [{ Note: `No orders for ${week}` }]),
    "Orders"
  );

  // Sheet 2: Daily operations
  const opRows: Record<string, string | number>[] = [];
  for (const o of orders) {
    const sub = subMap.get(o.subscriptionId);
    const cust = custMap.get(sub?.customerId ?? "");
    const addr = addrMap.get(o.addressId ?? "");
    const items = allItems.filter((it) => it.orderId === o.id);
    for (let d = 1; d <= 5; d++) {
      const dayItems = items.filter((it) => it.day === d);
      if (dayItems.length === 0) continue;
      const mealsLabel = dayItems.map((it) => {
        const mi = menuMap.get(it.menuItemId ?? "");
        return mi ? `${mi.name} ×${it.quantity}` : it.notes ?? "custom";
      }).join(", ");
      opRows.push({
        Day: DAY_NAMES[d],
        Customer: cust?.name ?? "",
        Phone: cust?.phone ?? "",
        Zone: cust?.zone ?? "",
        "Delivery Address": addr?.address ?? cust?.address ?? "",
        Meals: mealsLabel,
        "Order Status": o.status,
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(opRows.length ? opRows : [{ Note: "No meal selections this week" }]),
    "Daily Operations"
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const label = formatWeekLabel(week).replace(/[^a-zA-Z0-9-]/g, "-");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-${label}.xlsx"`,
    },
  });
}

