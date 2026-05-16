import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { validateSkipDate, createSkipWithExtension } from "@/lib/business/skip";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { source, externalUserId, confirmedByCustomer, subscriptionId, date, reason } =
    body as Record<string, unknown>;

  if (!confirmedByCustomer) {
    return NextResponse.json({ error: "confirmedByCustomer must be true" }, { status: 400 });
  }
  if (typeof subscriptionId !== "string" || typeof date !== "string") {
    return NextResponse.json({ error: "Missing or invalid fields: subscriptionId, date" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Expected YYYY-MM-DD" }, { status: 400 });
  }

  const customer = getCustomerById(customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const sub = getAllSubscriptions().find((s) => s.id === subscriptionId && s.customerId === customerId);
  if (!sub) return NextResponse.json({ error: "Subscription not found for this customer" }, { status: 404 });

  const validationError = validateSkipDate(subscriptionId, date);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  const result = createSkipWithExtension({
    subscriptionId,
    originalDay: date,
    reason: typeof reason === "string" ? reason : null,
  });

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    action: "skip_created",
    request: { subscriptionId, date },
    result: result.ok ? { status: "ok", skipId: result.skipId } : { status: "error", error: result.error },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ status: "ok", skipId: result.skipId });
}
