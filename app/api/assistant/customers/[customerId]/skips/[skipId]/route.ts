import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data/customers";
import { getAllSkips, getSubscriptionById } from "@/lib/data/subscriptions";
import { removeSkipAndRevert } from "@/lib/business/skip";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string; skipId: string }> }
) {
  const { customerId, skipId } = await params;
  const source = req.headers.get("x-source") ?? "unknown";
  const externalUserId = req.headers.get("x-external-user-id") ?? null;

  const customer = getCustomerById(customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const skip = getAllSkips().find((s) => s.id === skipId);
  if (!skip) return NextResponse.json({ error: "Skip not found" }, { status: 404 });

  const sub = getSubscriptionById(skip.subscriptionId);
  if (!sub || sub.customerId !== customerId) {
    return NextResponse.json({ error: "Skip does not belong to this customer" }, { status: 403 });
  }

  const result = removeSkipAndRevert(skipId);

  appendAssistantLog({
    source,
    externalUserId,
    customerId,
    action: "skip_deleted",
    request: { skipId, subscriptionId: skip.subscriptionId, date: skip.originalDay.slice(0, 10) },
    result: result.ok ? { status: "ok" } : { status: "error", error: result.error },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ status: "ok" });
}
