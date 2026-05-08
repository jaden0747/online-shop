import { sliderColor } from "./renewal-slider";

export function DistanceBar({ km }: { km: number | null }) {
  if (km === null) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const MAX_KM = 12;
  const widthPct = Math.min(100, (km / MAX_KM) * 100);
  const ratio = Math.min(1, km / MAX_KM);
  const color = sliderColor(ratio);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color }}>
        {km.toFixed(1)}km
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
