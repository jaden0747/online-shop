function sliderColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r <= 0.5) {
    const t = r / 0.5;
    const red = Math.round(0 + t * (234 - 0));
    const green = Math.round(180 + t * (179 - 180));
    const blue = Math.round(80 + t * (8 - 80));
    return `rgb(${red},${green},${blue})`;
  } else {
    const t = (r - 0.5) / 0.5;
    const red = Math.round(234 + t * (239 - 234));
    const green = Math.round(179 + t * (68 - 179));
    const blue = Math.round(8 + t * (68 - 8));
    return `rgb(${red},${green},${blue})`;
  }
}

export function RenewalSlider({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  if (days < 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: "rgb(127,29,29)" }}>
          {Math.abs(days)}d overdue
        </span>
        <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
          <div className="h-full w-full rounded-full" style={{ backgroundColor: "rgb(127,29,29)" }} />
        </div>
      </div>
    );
  }

  const MAX_DAYS = 14;
  const widthPct = Math.min(100, (days / MAX_DAYS) * 100);
  const ratio = 1 - Math.min(1, days / MAX_DAYS);
  const color = sliderColor(ratio);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color }}>
        {days}d left
      </span>
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export { sliderColor };
