import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { createPendingReview } from "@/lib/data/pending-reviews";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { source, externalUserId, subscriptionId, samePackage, note } =
    body as Record<string, unknown>;

  if (typeof subscriptionId !== "string") {
    return NextResponse.json({ error: "subscriptionId is required" }, { status: 400 });
  }
  if (typeof samePackage !== "boolean") {
    return NextResponse.json({ error: "samePackage (boolean) is required" }, { status: 400 });
  }

  const customer = getCustomerById(customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const sub = getAllSubscriptions().find((s) => s.id === subscriptionId && s.customerId === customerId);
  if (!sub) return NextResponse.json({ error: "Subscription not found for this customer" }, { status: 404 });

  const review = createPendingReview({
    type: "renewal_request",
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    subscriptionId,
    payload: {
      samePackage,
      note: typeof note === "string" ? note : null,
      currentEndDate: sub.endDate,
      mealsPerDay: sub.mealsPerDay,
      plan: sub.plan,
      goal: sub.goal,
    },
    managerNote: null,
  });

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    action: "renewal_request_created",
    request: { subscriptionId, samePackage },
    result: { status: "ok", reviewId: review.id },
  });

  return NextResponse.json({ status: "ok", reviewId: review.id });
}
