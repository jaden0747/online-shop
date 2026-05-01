import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import { currentWeekLabel, formatWeekLabel } from "@/lib/utils/week";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const week = searchParams.get("week") || currentWeekLabel();

  const menuItems = getMenuItemsByWeek(week).sort((a, b) =>
    a.day !== b.day ? a.day - b.day : a.slot - b.slot
  );

  const wb = XLSX.utils.book_new();

  const menuRows = menuItems.map((m) => ({
    "Week Label": week,
    Day: DAY_NAMES[m.day] ?? m.day,
    "Day Number": m.day,
    Slot: m.slot,
    Name: m.name,
    Description: m.description ?? "",
    Calories: m.calories ?? "",
    "Protein (g)": m.protein ?? "",
    Goals: m.goals,
  }));

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      menuRows.length ? menuRows : [{ Note: `No menu items for ${week}` }]
    ),
    `Menu ${week}`
  );

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const label = formatWeekLabel(week).replace(/[^a-zA-Z0-9-]/g, "-");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="menu-${label}.xlsx"`,
    },
  });
}
