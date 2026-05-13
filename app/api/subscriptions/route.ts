import { NextRequest, NextResponse } from "next/server";
import {
  getAllSubscriptions,
  createSubscription,
} from "@/lib/data/subscriptions";
import { getCustomerById } from "@/lib/data/customers";
import { addWorkingDays } from "@/lib/utils/subscription";

export const dynamic = "force-dynamic";

const VALID_PLANS = ["trial", "weekly", "monthly"];
const VALID_GOALS = ["cutting", "maintenance", "bulking", "keto"];

export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json(
      { error: "Missing ?customerId= query parameter" },
      { status: 400 }
    );
  }

  const all = getAllSubscriptions().filter(
    (s) => s.customerId === customerId
  );

  // Sort newest first
  all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    customerId,
    plan,
    goal,
    mealsPerDay,
    subscriptionPrice,
    shippingPrice,
    discount,
    trialDays,
    startDate: startDateRaw,
    addressId,
  } = body;

  if (!customerId || !plan || !goal || mealsPerDay == null) {
    return NextResponse.json(
      { error: "Missing required fields: customerId, plan, goal, mealsPerDay" },
      { status: 400 }
    );
  }

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `Invalid plan: "${plan}". Must be one of: ${VALID_PLANS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!VALID_GOALS.includes(goal)) {
    return NextResponse.json(
      { error: `Invalid goal: "${goal}". Must be one of: ${VALID_GOALS.join(", ")}` },
      { status: 400 }
    );
  }

  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found. Create the customer first." },
      { status: 404 }
    );
  }

  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();
  let endDate: Date;
  if (plan === "weekly") {
    endDate = addWorkingDays(startDate, 4);
  } else if (plan === "monthly") {
    endDate = addWorkingDays(startDate, 19);
  } else {
    endDate = addWorkingDays(startDate, (trialDays ?? 3) - 1);
  }

  const sub = createSubscription({
    customerId,
    plan,
    goal,
    mealsPerDay: Number(mealsPerDay),
    subscriptionPrice: Number(subscriptionPrice ?? 0),
    shippingPrice: Number(shippingPrice ?? 0),
    discount: Number(discount ?? 0),
    trialDays: plan === "trial" ? Number(trialDays ?? 3) : null,
    status: "active",
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    endDateNoSkip: endDate.toISOString(),
    cancelReason: null,
    cancelledAt: null,
    addressId: addressId ?? null,
  });

  return NextResponse.json(sub, { status: 201 });
}
