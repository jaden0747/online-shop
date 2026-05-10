export function CustomerNameWithNote({ name, note }: { name: string; note: string | null }) {
  if (!note) {
    return <span>{name}</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span>{name}</span>
      <span className="text-xs text-blue-600 dark:text-blue-400 whitespace-pre-wrap">
        {note}
      </span>
    </div>
  );
}
