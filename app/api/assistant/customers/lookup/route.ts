import { NextRequest, NextResponse } from "next/server";
import { getAllCustomers } from "@/lib/data/customers";
import { getAllLeads } from "@/lib/data/leads";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { phone, name, source = "unknown", externalUserId = null } = body;

  const all = getAllCustomers();

  // Resolve externalUserId from a customer phone
  const resolveExternalUserId = (ph: string) => {
    const d = ph.replace(/\D/g, "");
    const lead = getAllLeads()
      .filter((l) => l.externalUserId && l.phone.replace(/\D/g, "") === d)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return lead?.externalUserId ?? null;
  };

  // Name-based lookup (manager use)
  if (name && typeof name === "string" && name.trim()) {
    const query = normalize(name);
    const matches = all.filter((c) => normalize(c.name).includes(query));

    let result: Record<string, unknown>;
    if (matches.length === 0) {
      result = { status: "not_found" };
    } else if (matches.length === 1) {
      const c = matches[0];
      result = {
        status: "matched",
        customer: { id: c.id, name: c.name, phone: c.phone },
        externalUserId: resolveExternalUserId(c.phone),
      };
    } else {
      result = {
        status: "multiple_matches",
        candidates: matches.map((c) => ({
          name: c.name,
          phone: c.phone,
          externalUserId: resolveExternalUserId(c.phone),
        })),
      };
    }

    appendAssistantLog({
      source: String(source),
      externalUserId: null,
      customerId: matches.length === 1 ? matches[0].id : null,
      action: "customer_lookup",
      request: { name: name.trim() },
      result,
    });
    return NextResponse.json(result);
  }

  // If no phone provided but externalUserId is, resolve via leads
  if (!phone || typeof phone !== "string") {
    if (typeof externalUserId !== "string" || !externalUserId) {
      return NextResponse.json({ error: "name, phone, or externalUserId is required" }, { status: 400 });
    }

    // Find the most recent lead for this externalUserId that has a phone
    const lead = getAllLeads()
      .filter((l) => l.externalUserId === externalUserId && l.phone)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (!lead) {
      const result = { status: "not_found" };
      appendAssistantLog({
        source: String(source),
        externalUserId,
        customerId: null,
        action: "customer_lookup",
        request: { externalUserId },
        result,
      });
      return NextResponse.json(result);
    }

    // Try to find a matched customer using the lead's phone
    const digitsOnly = lead.phone.replace(/\D/g, "");
    const matches = all.filter((c) => {
      const cd = c.phone.replace(/\D/g, "");
      return c.phone === lead.phone || cd === digitsOnly;
    });

    let result: Record<string, unknown>;
    if (matches.length === 1) {
      const c = matches[0];
      result = { status: "matched", customer: { id: c.id, name: c.name, phone: c.phone } };
    } else if (matches.length > 1) {
      result = { status: "multiple_matches", count: matches.length };
    } else {
      // Lead exists but customer not converted yet
      result = {
        status: "lead_only",
        lead: { id: lead.id, name: lead.name, phone: lead.phone, leadStatus: lead.status },
      };
    }

    appendAssistantLog({
      source: String(source),
      externalUserId,
      customerId: matches.length === 1 ? matches[0].id : null,
      action: "customer_lookup",
      request: { externalUserId },
      result,
    });
    return NextResponse.json(result);
  }

  // Normal phone-based lookup
  const normalized = phone.trim();
  const digitsOnly = normalized.replace(/\D/g, "");

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
      externalUserId: resolveExternalUserId(c.phone),
    };
  }

  appendAssistantLog({
    source: String(source),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId: matches.length === 1 ? matches[0].id : null,
    action: "customer_lookup",
    request: { phone: normalized },
    result,
  });

  return NextResponse.json(result);
}
