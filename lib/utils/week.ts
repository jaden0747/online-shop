export function weekLabelForDate(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekLabelToDateRange(label: string): string {
  const [yearStr, weekPart] = label.split("-W");
  const year = parseInt(yearStr, 10);
  const weekNum = parseInt(weekPart, 10);

  const jan1 = new Date(year, 0, 1);
  jan1.setHours(0, 0, 0, 0);
  // Find the first Monday of the year
  const jan1Dow = jan1.getDay(); // 0=Sun
  const daysToFirstMon = jan1Dow === 0 ? 1 : jan1Dow === 1 ? 0 : 8 - jan1Dow;
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() + daysToFirstMon);

  // Week 1 starts on or before Jan 1 when Jan 1 is Mon–Thu;
  // when Jan 1 is Fri–Sun the first Monday is already in week 2 per the custom formula.
  // The formula week = ceil((dayOfYear + startOfYear.getDay() + 1) / 7) gives week 1 for Jan 1
  // regardless, so Monday of week N = Jan 1 + (N-1)*7 - (jan1Dow) days, adjusted to hit Monday.
  // Simpler: iterate from Jan 1 until weekLabelForDate matches.
  const monday = new Date(jan1);
  monday.setHours(0, 0, 0, 0);
  // Walk to the Monday whose weekLabelForDate equals the target label
  // Start from firstMonday and offset by weekNum-1 weeks, then verify.
  // Use the inverse: Monday of weekN = firstMonday + (weekNum - weekLabelForDate(firstMonday week)) * 7
  const firstMondayWeek = parseInt(weekLabelForDate(firstMonday).split("-W")[1], 10);
  monday.setDate(firstMonday.getDate() + (weekNum - firstMondayWeek) * 7);

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

export function currentWeekLabel(): string {
  return weekLabelForDate(new Date());
}

export function formatWeekLabel(label: string): string {
  const [year, weekPart] = label.split("-W");
  return `Week ${weekPart}, ${year}`;
}

export function currentWeekMonday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun
  const daysToMon = dow === 0 ? -6 : 1 - dow;
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
