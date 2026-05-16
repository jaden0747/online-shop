import { NextRequest, NextResponse } from "next/server";
import { getAllCustomers } from "@/lib/data/customers";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { phone, source = "unknown", externalUserId = null } = body;

  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  // Normalize: strip whitespace; match both formatted and digit-only
  const normalized = phone.trim();
  const digitsOnly = normalized.replace(/\D/g, "");

  const all = getAllCustomers();
  const matches = all.filter((c) => {
    const cd = c.phone.replace(/\D/g, "");
    return c.phone === normalized || cd === digitsOnly;
  });

  let result: Record<string, unknown>;
  if (matches.length === 0) {
    result = { status: "not_found" };
  } else if (matches.length > 1) {
    result = { status: "multiple_matches", count: matches.length };
  } else {
    const c = matches[0];
    result = {
      status: "matched",
      customer: { id: c.id, name: c.name, phone: c.phone },
    };
  }

  appendAssistantLog({
    source,
    externalUserId,
    customerId: matches.length === 1 ? matches[0].id : null,
    action: "customer_lookup",
    request: { phone: normalized },
    result,
  });

  return NextResponse.json(result);
}
