function mondayOfWeekLabel(weekLabel: string): Date {
  const [yearStr, weekPart] = weekLabel.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);

  const jan1 = new Date(year, 0, 1);
  jan1.setHours(0, 0, 0, 0);
  const jan1Dow = jan1.getDay();

  const dayOfYear = (week - 1) * 7 - jan1Dow;
  const monday = new Date(year, 0, 1 + dayOfYear);
  monday.setHours(0, 0, 0, 0);

  while (monday.getDay() !== 1) {
    monday.setDate(monday.getDate() + 1);
  }

  return monday;
}

export function WeekRangeLabel({ weekLabel }: { weekLabel: string }) {
  const monday = mondayOfWeekLabel(weekLabel);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const monDay = monday.getDate();
  const friDay = friday.getDate();
  const monMonth = monday.getMonth();
  const friMonth = friday.getMonth();
  const monYear = monday.getFullYear();
  const friYear = friday.getFullYear();

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let label: string;
  if (monYear !== friYear) {
    label = `${monDay} ${monthNames[monMonth]} ${monYear} – ${friDay} ${monthNames[friMonth]} ${friYear}`;
  } else if (monMonth !== friMonth) {
    label = `${monDay} ${monthNames[monMonth]} – ${friDay} ${monthNames[friMonth]} ${friYear}`;
  } else {
    label = `${monDay} – ${friDay} ${monthNames[monMonth]} ${monYear}`;
  }

  return <span>{label}</span>;
}
