import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerById,
  getAllAddresses,
  createCustomer,
} from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { isSubscriptionLive } from "@/lib/utils/subscription";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json(
      { error: "Missing ?phone= query parameter" },
      { status: 400 }
    );
  }

  const customer = getCustomerById(phone);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const addresses = getAllAddresses().filter(
    (a) => a.customerId === customer.phone
  );
  const subscriptions = getAllSubscriptions().filter(
    (s) =>
      s.customerId === customer.phone &&
      isSubscriptionLive(s.status, s.startDate, s.endDate)
  );

  return NextResponse.json({
    ...customer,
    addresses,
    activeSubscriptions: subscriptions,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, phone, address, zone, notes } = body;

  if (!name || !phone || !address || !zone) {
    return NextResponse.json(
      { error: "Missing required fields: name, phone, address, zone" },
      { status: 400 }
    );
  }

  const existing = getCustomerById(phone);
  if (existing) {
    return NextResponse.json(
      { error: "Customer with this phone already exists", customer: existing },
      { status: 409 }
    );
  }

  const customer = createCustomer({ name, phone, address, zone, notes: notes ?? null });
  return NextResponse.json(customer, { status: 201 });
}
