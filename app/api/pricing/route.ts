import { NextResponse } from "next/server";
import { getAllPricing } from "@/lib/data/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  const pricing = getAllPricing();

  // Group by plan for easier consumption by the AI agent
  const byPlan: Record<string, Record<string, Record<string, number>>> = {};
  for (const p of pricing) {
    byPlan[p.plan] ??= {};
    byPlan[p.plan][p.goal] ??= {};
    byPlan[p.plan][p.goal][String(p.mealsPerDay)] = p.totalPrice;
  }

  return NextResponse.json({
    plans: {
      trial: "1 meal/day for 3 days",
      weekly: "5 meals over 1 week (Mon–Fri)",
      monthly: "20 meals over 1 month (4 weeks)",
    },
    goals: {
      cutting: "Weight loss / lean muscle",
      maintenance: "Maintain current weight",
      bulking: "Muscle gain / mass building",
      keto: "Low-carb, high-fat",
    },
    pricing: byPlan,
    raw: pricing,
  });
}
