import { daysRemaining } from "@/lib/utils/subscription";

export function SubscriptionEndDateCell({
  endDate,
  compact = false,
}: {
  endDate: string;
  compact?: boolean;
}) {
  const days = daysRemaining(endDate);
  let textClass: string;
  let barClass: string;
  if (days >= 14) { textClass = "text-green-600"; barClass = "bg-green-500"; }
  else if (days >= 7) { textClass = "text-yellow-600"; barClass = "bg-yellow-500"; }
  else if (days >= 3) { textClass = "text-orange-600"; barClass = "bg-orange-500"; }
  else { textClass = "text-red-600"; barClass = "bg-red-500"; }
  const fillPct = Math.min(100, Math.round((days / 14) * 100));
  return (
    <div className="min-w-[70px]">
      <span className={`text-xs font-medium ${textClass}`}>
        {compact ? `${days}d` : `${days} days`}
      </span>
      <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
        <div className={`h-1 rounded-full ${barClass}`} style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}
