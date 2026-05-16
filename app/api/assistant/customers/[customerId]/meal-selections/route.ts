import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data/customers";
import { getAllSubscriptions } from "@/lib/data/subscriptions";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import {
  currentWeekLabel,
  weekLabelToDateRange,
  weekLabelToMonday,
} from "@/lib/utils/week";
import { appendAssistantLog } from "@/lib/data/assistant-log";
import { validateAndUpsertSelection } from "@/lib/business/selection";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const source = req.headers.get("x-source") ?? "unknown";
  const externalUserId = req.headers.get("x-external-user-id") ?? null;

  const customer = getCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const weekParam = req.nextUrl.searchParams.get("week");
  if (weekParam && !/^\d{4}-W\d{2}$/.test(weekParam)) {
    return NextResponse.json(
      { error: "Invalid week format. Expected YYYY-Www (e.g. 2026-W21)" },
      { status: 400 }
    );
  }
  const weekLabel = weekParam ?? currentWeekLabel();

  const subIds = new Set(
    getAllSubscriptions()
      .filter((s) => s.customerId === customer.id)
      .map((s) => s.id)
  );

  const menuItems = getMenuItemsByWeek(weekLabel);
  const monday = weekLabelToMonday(weekLabel);

  const selections = getSelectionsByWeek(weekLabel)
    .filter((sel) => subIds.has(sel.subscriptionId))
    .map((sel) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + sel.day - 1);
      const item = menuItems.find((m) => m.day === sel.day && m.slot === sel.menuSlot);
      return {
        subscriptionId: sel.subscriptionId,
        day: sel.day,
        date: date.toISOString().slice(0, 10),
        mealNum: sel.mealNum,
        menuSlot: sel.menuSlot,
        menuItemName: item?.name ?? null,
      };
    })
    .sort((a, b) => a.day - b.day || a.mealNum - b.mealNum);

  appendAssistantLog({
    source,
    externalUserId,
    customerId: customer.id,
    action: "meal_selections_read",
    request: { weekLabel },
    result: { status: "ok", count: selections.length },
  });

  return NextResponse.json({
    weekLabel,
    dateRange: weekLabelToDateRange(weekLabel),
    selections,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { source, externalUserId, confirmedByCustomer, subscriptionId, weekLabel, day, selections } = body as Record<string, unknown>;

  if (!confirmedByCustomer) {
    return NextResponse.json({ error: "confirmedByCustomer must be true" }, { status: 400 });
  }
  if (typeof subscriptionId !== "string" || typeof weekLabel !== "string" || typeof day !== "number" || !Array.isArray(selections)) {
    return NextResponse.json({ error: "Missing or invalid fields: subscriptionId, weekLabel, day, selections" }, { status: 400 });
  }
  if (!/^\d{4}-W\d{2}$/.test(weekLabel)) {
    return NextResponse.json({ error: "Invalid weekLabel format. Expected YYYY-Www" }, { status: 400 });
  }

  const customer = getCustomerById(customerId);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const sub = getAllSubscriptions().find((s) => s.id === subscriptionId && s.customerId === customerId);
  if (!sub) return NextResponse.json({ error: "Subscription not found for this customer" }, { status: 404 });

  const errors: Array<{ mealNum: number; error: string }> = [];
  for (const sel of selections as Array<{ mealNum: number; menuSlot: number }>) {
    const result = validateAndUpsertSelection({ weekLabel, subscriptionId, day, mealNum: sel.mealNum, menuSlot: sel.menuSlot });
    if (!result.ok) errors.push({ mealNum: sel.mealNum, error: result.error });
  }

  appendAssistantLog({
    source: String(source ?? "unknown"),
    externalUserId: typeof externalUserId === "string" ? externalUserId : null,
    customerId,
    action: "meal_selections_write",
    request: { subscriptionId, weekLabel, day, selectionCount: selections.length },
    result: errors.length === 0 ? { status: "ok" } : { status: "partial", errors },
  });

  if (errors.length > 0) {
    return NextResponse.json({ status: "partial", errors }, { status: 207 });
  }
  return NextResponse.json({ status: "ok" });
}
