"use client";

export function CustomerNote({
  value,
  onChange,
  onBlur,
  isSaving,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        Note
        {isSaving && <span className="font-normal normal-case opacity-60">saving…</span>}
      </label>
      <textarea
        className="w-full min-h-[56px] rounded border border-input bg-transparent px-2 py-1.5 text-xs resize-none outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 placeholder:text-muted-foreground"
        placeholder="No note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
