import { NextRequest, NextResponse } from "next/server";
import { createLead, getAllLeads } from "@/lib/data/leads";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const phone = searchParams.get("phone");
  const externalUserId = searchParams.get("externalUserId");
  const source = req.headers.get("x-source") ?? "unknown";
  const extUser = req.headers.get("x-external-user-id") ?? externalUserId ?? null;

  if (!phone && !externalUserId) {
    return NextResponse.json(
      { error: "Provide at least one of: phone, externalUserId" },
      { status: 400 }
    );
  }

  let leads = getAllLeads();
  if (phone) leads = leads.filter((l) => l.phone === phone);
  if (externalUserId) leads = leads.filter((l) => l.externalUserId === externalUserId);

  appendAssistantLog({
    source,
    externalUserId: extUser,
    customerId: null,
    action: "leads_lookup",
    request: { phone: phone ?? undefined, externalUserId: externalUserId ?? undefined },
    result: { count: leads.length },
  });

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const {
    source,
    externalUserId,
    name,
    phone,
    address,
    lat,
    lng,
    goal,
    mealsPerDay,
    planInterest,
    note,
  } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const geocodedLat = typeof lat === "number" ? lat : null;
  const geocodedLng = typeof lng === "number" ? lng : null;

  const lead = createLead({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    name: name.trim(),
    phone: phone.trim(),
    address: typeof address === "string" ? address.trim() || null : null,
    geocodedLat,
    geocodedLng,
    goal: typeof goal === "string" ? goal.trim() || null : null,
    mealsPerDay: typeof mealsPerDay === "number" ? mealsPerDay : null,
    planInterest: typeof planInterest === "string" ? planInterest.trim() || null : null,
    note: typeof note === "string" ? note.trim() || null : null,
  });

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId: null,
    action: "lead_created",
    request: { name, phone },
    result: { status: "ok", leadId: lead.id },
  });

  return NextResponse.json({ status: "ok", leadId: lead.id });
}
