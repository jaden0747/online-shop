import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { getAllAddresses } from "@/lib/data/customers";
import { upsertDayAddress } from "@/lib/data/order-day-addresses";
import { weekLabelForDate, isoDayOfWeek } from "@/lib/utils/week";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { source, externalUserId, confirmedByCustomer, subscriptionId, date, addressId } =
    body as Record<string, unknown>;

  if (!confirmedByCustomer) {
    return NextResponse.json({ error: "confirmedByCustomer must be true" }, { status: 400 });
  }
  if (typeof subscriptionId !== "string" || typeof date !== "string" || typeof addressId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid fields: subscriptionId, date, addressId" },
      { status: 400 }
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Expected YYYY-MM-DD" }, { status: 400 });
  }

  const customer = getCustomerById(customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const sub = getAllSubscriptions().find((s) => s.id === subscriptionId && s.customerId === customerId);
  if (!sub) return NextResponse.json({ error: "Subscription not found for this customer" }, { status: 404 });

  const addr = getAllAddresses().find((a) => a.id === addressId && a.customerId === customerId);
  if (!addr) return NextResponse.json({ error: "Address not found for this customer" }, { status: 404 });

  const parsed = new Date(date + "T00:00:00");
  const dayNum = isoDayOfWeek(parsed);
  if (dayNum > 5) {
    return NextResponse.json({ error: "Date must be a weekday (Monday–Friday)" }, { status: 422 });
  }

  const weekLabel = weekLabelForDate(parsed);
  upsertDayAddress(subscriptionId, weekLabel, dayNum, addressId);

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    action: "day_address_set",
    request: { subscriptionId, date, addressId, weekLabel, dayNum },
    result: { status: "ok" },
  });

  return NextResponse.json({ status: "ok", weekLabel, day: dayNum });
}
