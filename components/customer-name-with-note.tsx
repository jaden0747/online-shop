export function CustomerNameWithNote({ name, note }: { name: string; note: string | null }) {
  if (!note) {
    return <span>{name}</span>;
  }

  const truncated = note.length > 40 ? note.slice(0, 40) + "…" : note;

  return (
    <div className="flex flex-col gap-0.5">
      <span>{name}</span>
      <span className="text-xs text-muted-foreground truncate" title={note}>
        {truncated}
      </span>
    </div>
  );
}
