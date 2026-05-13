import { NextRequest, NextResponse } from "next/server";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { currentWeekLabel } from "@/lib/utils/week";
import { getSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week") ?? currentWeekLabel();

  const menuItems = getMenuItemsByWeek(week).sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.slot - b.slot
  );

  const settings = getSettings();

  const enriched = menuItems.map((item) => ({
    day: item.day,
    dayName: DAY_NAMES[item.day] ?? String(item.day),
    slot: item.slot,
    name: item.name,
    description: item.description,
    calories: item.calories,
    protein: item.protein,
    goals: item.goals?.split(",").map((g: string) => g.trim()).filter(Boolean),
  }));

  return NextResponse.json({
    weekLabel: week,
    mealPrices: {
      cutting: settings.mealPriceCutting,
      maintenance: settings.mealPriceMaintenance,
      bulking: settings.mealPriceBulking,
      keto: settings.mealPriceKeto,
    },
    items: enriched,
  });
}
