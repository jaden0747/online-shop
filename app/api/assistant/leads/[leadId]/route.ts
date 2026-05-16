import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLead } from "@/lib/data/leads";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { source, externalUserId, name, phone, address, goal, mealsPerDay, planInterest, note } =
    body as Record<string, unknown>;

  const lead = getLeadById(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (lead.status !== "pending") {
    return NextResponse.json(
      { error: `Lead is already ${lead.status} and cannot be updated` },
      { status: 409 }
    );
  }

  const updates: Parameters<typeof updateLead>[1] = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof phone === "string" && phone.trim()) updates.phone = phone.trim();
  if (typeof address === "string") updates.address = address.trim() || null;
  if (typeof goal === "string") updates.goal = goal.trim() || null;
  if (typeof mealsPerDay === "number") updates.mealsPerDay = mealsPerDay;
  if (typeof planInterest === "string") updates.planInterest = planInterest.trim() || null;
  if (typeof note === "string") updates.note = note.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const updated = updateLead(leadId, updates);

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId: null,
    action: "lead_updated",
    request: { leadId, updates },
    result: { status: "ok" },
  });

  return NextResponse.json({ status: "ok", lead: updated });
}
