import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, getAllAddresses } from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips, getAllExtras } from "@/lib/data/subscriptions";
import { getAllPayments } from "@/lib/data/payments";
import { getCreditTransactionsByCustomer } from "@/lib/data/credits";
import { getSelectionsByWeek } from "@/lib/data/selections";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import {
  subscriptionStatus,
  daysRemaining,
  isSubscriptionLive,
} from "@/lib/utils/subscription";
import { subscriptionPaymentStatus } from "@/lib/utils/payments";
import { creditBalance } from "@/lib/utils/credits";
import {
  currentWeekLabel,
  weekLabelToMonday,
  weekLabelToDateRange,
} from "@/lib/utils/week";
import { appendAssistantLog } from "@/lib/data/assistant-log";

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

  const addresses = getAllAddresses()
    .filter((a) => a.customerId === customer.id)
    .map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      zone: a.zone,
      isDefault: a.isDefault,
      hasCoordinates: a.latitude != null && a.longitude != null,
    }));

  const allSubs = getAllSubscriptions().filter((s) => s.customerId === customer.id);
  const allSkips = getAllSkips();
  const allExtras = getAllExtras();
  const allPayments = getAllPayments();
  const creditTxs = getCreditTransactionsByCustomer(customer.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Only expose active and upcoming subscriptions
  const relevantSubs = allSubs.filter((s) => {
    const st = subscriptionStatus(s.status, s.startDate, s.endDate);
    return st === "active" || st === "upcoming";
  });

  const subscriptions = relevantSubs.map((sub) => {
    const subSkips = allSkips.filter((sk) => sk.subscriptionId === sub.id);
    const subExtras = allExtras.filter((e) => e.subscriptionId === sub.id);
    const st = subscriptionStatus(sub.status, sub.startDate, sub.endDate);
    const payStatus = subscriptionPaymentStatus(sub, allPayments, subExtras, subSkips, creditTxs);

    return {
      id: sub.id,
      plan: sub.plan,
      goal: sub.goal,
      mealsPerDay: sub.mealsPerDay,
      status: st,
      startDate: sub.startDate.slice(0, 10),
      endDate: sub.endDate.slice(0, 10),
      daysRemaining: st === "active" ? daysRemaining(sub.endDate) : null,
      totalDue: payStatus.totalDue,
      balance: payStatus.balance,
      paymentStatus: payStatus.status,
      skipCount: subSkips.length,
    };
  });

  // Upcoming skips (date >= today) for active subscriptions
  const activeSubs = new Set(
    allSubs
      .filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate, today))
      .map((s) => s.id)
  );
  const upcomingSkips = allSkips
    .filter((sk) => {
      if (!activeSubs.has(sk.subscriptionId)) return false;
      const d = new Date(sk.originalDay);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    })
    .sort((a, b) => a.originalDay.localeCompare(b.originalDay))
    .map((sk) => ({
      skipId: sk.id,
      subscriptionId: sk.subscriptionId,
      date: sk.originalDay.slice(0, 10),
      replacementDate: sk.replacementDay ? sk.replacementDay.slice(0, 10) : null,
      reason: sk.reason,
    }));

  // Current week meal selections with menu item names
  const weekLabel = currentWeekLabel();
  const menuItems = getMenuItemsByWeek(weekLabel);
  const subIds = new Set(allSubs.map((s) => s.id));
  const currentWeekSelections = getSelectionsByWeek(weekLabel)
    .filter((sel) => subIds.has(sel.subscriptionId))
    .map((sel) => {
      const monday = weekLabelToMonday(weekLabel);
      const d = new Date(monday);
      d.setDate(monday.getDate() + sel.day - 1);
      const item = menuItems.find((m) => m.day === sel.day && m.slot === sel.menuSlot);
      return {
        subscriptionId: sel.subscriptionId,
        weekLabel: sel.weekLabel,
        day: sel.day,
        date: d.toISOString().slice(0, 10),
        mealNum: sel.mealNum,
        menuSlot: sel.menuSlot,
        menuItemName: item?.name ?? null,
      };
    })
    .sort((a, b) => a.day - b.day || a.mealNum - b.mealNum);

  const balance = creditBalance(creditTxs);

  appendAssistantLog({
    source,
    externalUserId,
    customerId: customer.id,
    action: "customer_overview",
    request: {},
    result: { status: "ok" },
  });

  return NextResponse.json({
    customer: { id: customer.id, name: customer.name, phone: customer.phone },
    addresses,
    subscriptions,
    creditBalance: balance > 0 ? balance : 0,
    upcomingSkips,
    currentWeekLabel: weekLabel,
    currentWeekDateRange: weekLabelToDateRange(weekLabel),
    currentWeekSelections,
  });
}
