import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAllCustomers, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { getAllOrders, getAllOrderItems } from "@/lib/data/orders";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { currentWeekLabel } from "@/lib/utils/week";
import { formatDate, isSubscriptionLive } from "@/lib/utils/subscription";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  return formatDate(d);
}

export async function GET() {
  const weekLabel = currentWeekLabel();

  const customers = getAllCustomers().sort((a, b) => a.name.localeCompare(b.name));
  const addresses = getAllAddresses();
  const subscriptions = getAllSubscriptions().filter((s) => isSubscriptionLive(s.status, s.startDate, s.renewalDate));
  const orders = getAllOrders().filter((o) => o.weekLabel === weekLabel);
  const orderIds = new Set(orders.map((o) => o.id));
  const orderItems = getAllOrderItems().filter((it) => orderIds.has(it.orderId));
  const menuItems = getMenuItemsByWeek(weekLabel).sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.slot - b.slot
  );

  const custMap = new Map(customers.map((c) => [c.phone, c]));
  const subMap = new Map(getAllSubscriptions().map((s) => [s.id, s]));
  const addrMap = new Map(addresses.map((a) => [a.id, a]));

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Customers ────────────────────────────────────────────────────
  const customerRows = customers.map((c) => {
    const custAddrs = addresses.filter((a) => a.customerId === c.phone);
    return {
      Name: c.name,
      "Phone Number": c.phone,
      "Default Address": c.address,
      Zone: c.zone,
      Notes: c.notes ?? "",
      "Alt Address": custAddrs
        .filter((a) => !a.isDefault)
        .map((a) => a.address)
        .join("; "),
      "Created At": fmt(c.createdAt),
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(customerRows.length ? customerRows : [{ Note: "No customers" }]),
    "Customers"
  );

  // ── Sheet 2: Active Subscriptions ─────────────────────────────────────────
  const subRows = subscriptions.map((s) => {
    const cust = custMap.get(s.customerId);
    return {
      Customer: cust?.name ?? s.customerId,
      "Phone Number": s.customerId,
      Plan: s.plan,
      Goal: s.goal,
      "Meals/Day": s.mealsPerDay,
      "Package Price": s.packagePrice,
      "Price/Meal": s.pricePerMeal.toFixed(2),
      "Start Date": fmt(s.startDate),
      "Renewal Date": fmt(s.renewalDate),
      Status: s.status,
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(subRows.length ? subRows : [{ Note: "No active subscriptions" }]),
    "Subscriptions"
  );

  // ── Sheet 3: Orders (current week) ────────────────────────────────────────
  const orderRows = orders.map((o) => {
    const sub = subMap.get(o.subscriptionId);
    const customer = custMap.get(sub?.customerId ?? "");
    const addr = addrMap.get(o.addressId ?? "");
    const items = orderItems.filter((it) => it.orderId === o.id);
    const meals: Record<string, string> = {};
    DAY_NAMES.slice(1).forEach((day, i) => {
      const dayItems = items.filter((it) => it.day === i + 1);
      meals[day] = dayItems.length === 0
        ? ""
        : dayItems.map((it) => it.notes ?? "custom").join(", ");
    });
    return {
      Customer: customer?.name ?? "",
      Phone: customer?.phone ?? "",
      Plan: sub?.plan ?? "",
      Goal: sub?.goal ?? "",
      Zone: customer?.zone ?? "",
      "Delivery Address": addr?.address ?? customer?.address ?? "",
      Status: o.status,
      Monday: meals["Monday"],
      Tuesday: meals["Tuesday"],
      Wednesday: meals["Wednesday"],
      Thursday: meals["Thursday"],
      Friday: meals["Friday"],
    };
  });
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(orderRows.length ? orderRows : [{ Note: `No orders for ${weekLabel}` }]),
    `Orders`
  );

  // ── Sheet 4: Menu (current week) ──────────────────────────────────────────
  const menuRows = menuItems.map((m) => ({
    Day: DAY_NAMES[m.day] ?? m.day,
    Slot: m.slot,
    Name: m.name,
    Description: m.description ?? "",
    Calories: m.calories ?? "",
    "Protein (g)": m.protein ?? "",
    Goals: m.goals,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(menuRows.length ? menuRows : [{ Note: `No menu for ${weekLabel}` }]),
    "Menu"
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="shop-export-${weekLabel}.xlsx"`,
    },
  });
}
