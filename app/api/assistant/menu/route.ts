import { NextRequest, NextResponse } from "next/server";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import {
  weekLabelForDate,
  weekLabelToDateRange,
  weekLabelToMonday,
  currentWeekLabel,
} from "@/lib/utils/week";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  let weekLabel: string;

  const weekParam = searchParams.get("week");
  const dateParam = searchParams.get("date");

  if (weekParam) {
    if (!/^\d{4}-W\d{2}$/.test(weekParam)) {
      return NextResponse.json(
        { error: "Invalid week format. Expected YYYY-Www (e.g. 2026-W21)" },
        { status: 400 }
      );
    }
    weekLabel = weekParam;
  } else if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      );
    }
    weekLabel = weekLabelForDate(new Date(dateParam + "T00:00:00"));
  } else {
    weekLabel = currentWeekLabel();
  }

  const items = getMenuItemsByWeek(weekLabel);
  const monday = weekLabelToMonday(weekLabel);

  const days = [1, 2, 3, 4, 5].map((dayNum) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayNum - 1);

    const dayItems = items.filter((m) => m.day === dayNum);
    const slots = dayItems
      .sort((a, b) => a.slot - b.slot)
      .map((m) => ({
        slot: m.slot,
        name: m.name,
        description: m.description,
        calories: m.calories,
        protein: m.protein,
        goals: m.goals
          ? m.goals
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : [],
      }));

    return {
      day: dayNum,
      date: date.toISOString().slice(0, 10),
      slots,
    };
  });

  // Menu is complete when every weekday has at least one slot defined
  const isComplete = days.every((d) => d.slots.length > 0);

  return NextResponse.json({
    weekLabel,
    dateRange: weekLabelToDateRange(weekLabel),
    isComplete,
    days,
  });
}
