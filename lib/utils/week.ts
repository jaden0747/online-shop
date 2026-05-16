/** ISO 8601 week label for a given date, e.g. "2026-W21". */
export function weekLabelForDate(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7; // Sun = 7
  d.setDate(d.getDate() + 4 - day); // shift to Thursday of this ISO week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Human-readable date range for a week label, e.g. "12 – 16 May 2026". */
export function weekLabelToDateRange(label: string): string {
  const monday = weekLabelToMonday(label);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monDay = monday.getDate();
  const monMonth = MONTHS[monday.getMonth()];
  const friDay = friday.getDate();
  const friMonth = MONTHS[friday.getMonth()];
  const friYear = friday.getFullYear();

  if (monday.getMonth() === friday.getMonth()) {
    return `${monDay} – ${friDay} ${friMonth} ${friYear}`;
  }
  return `${monDay} ${monMonth} – ${friDay} ${friMonth} ${friYear}`;
}

/** Returns the Monday Date for a given ISO week label (e.g. "2026-W21"). */
export function weekLabelToMonday(label: string): Date {
  const [yearStr, weekPart] = label.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekPart, 10);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  jan4.setHours(0, 0, 0, 0);
  const day = jan4.getDay() || 7; // Mon=1 … Sun=7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (day - 1) + (weekNum - 1) * 7);
  return monday;
}

/** ISO week label for the current week. Treats Sunday as the last day of the
 *  current week (not the first of the next), matching currentWeekMonday(). */
export function currentWeekLabel(): string {
  return weekLabelForDate(currentWeekMonday());
}

/** "Week 21, 2026" display label. */
export function formatWeekLabel(label: string): string {
  const [year, weekPart] = label.split("-W");
  return `Week ${weekPart}, ${year}`;
}

/** Monday of the current ISO week. On Sundays returns the upcoming Monday
 *  so that the app always shows the active/upcoming delivery week. */
export function currentWeekMonday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = Sun
  // Sunday → advance to upcoming Monday; other days → back to this Monday
  const daysToMon = dow === 0 ? 1 : 1 - dow;
  today.setDate(today.getDate() + daysToMon);
  return today;
}

export function nextWeekLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return weekLabelForDate(d);
}

export function nextWeekMonday(): Date {
  const mon = currentWeekMonday();
  mon.setDate(mon.getDate() + 7);
  return mon;
}

/** Shift a week label by ±N weeks. Handles ISO year-boundary rollovers correctly. */
export function shiftWeekLabel(label: string, weeks: number): string {
  const monday = weekLabelToMonday(label);
  monday.setDate(monday.getDate() + weeks * 7);
  return weekLabelForDate(monday);
}

/** ISO day-of-week: Mon=1, Tue=2, …, Sat=6, Sun=7. */
export function isoDayOfWeek(date: Date): number {
  return date.getDay() || 7;
}
