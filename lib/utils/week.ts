export function weekLabelForDate(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
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
