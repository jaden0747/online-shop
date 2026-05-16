import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { createPendingReview } from "@/lib/data/pending-reviews";
import { appendAssistantLog } from "@/lib/data/assistant-log";
import type { PendingReview } from "@/lib/data/types";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES: PendingReview["type"][] = [
  "new_address",
  "cancellation_request",
  "refund_request",
  "payment_proof",
  "phone_change",
  "price_change",
  "renewal_request",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { source, externalUserId, type, subscriptionId, payload } =
    body as Record<string, unknown>;

  if (typeof type !== "string" || !ALLOWED_TYPES.includes(type as PendingReview["type"])) {
    return NextResponse.json(
      { error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const customer = getCustomerById(customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  // Validate subscriptionId ownership when provided
  let resolvedSubId: string | null = null;
  if (typeof subscriptionId === "string") {
    const sub = getAllSubscriptions().find(
      (s) => s.id === subscriptionId && s.customerId === customerId
    );
    if (!sub) {
      return NextResponse.json(
        { error: "Subscription not found for this customer" },
        { status: 404 }
      );
    }
    resolvedSubId = subscriptionId;
  }

  const review = createPendingReview({
    type: type as PendingReview["type"],
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    subscriptionId: resolvedSubId,
    payload: typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {},
    managerNote: null,
  });

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    action: `review_requested:${type}`,
    request: { type, subscriptionId: resolvedSubId },
    result: { status: "ok", reviewId: review.id },
  });

  return NextResponse.json({ status: "ok", reviewId: review.id });
}
