"use client";

import { useTransition, useState } from "react";
import { updateReviewStatusAction } from "@/app/actions/assistant";

export function ReviewActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);

  function submit(status: "approved" | "rejected") {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    if (note.trim()) fd.set("note", note.trim());
    startTransition(() => updateReviewStatusAction(fd));
  }

  return (
    <div className="space-y-1.5">
      {expanded && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Manager note (optional)"
          rows={2}
          className="w-full text-xs border rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary bg-background"
        />
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("approved")}
          className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("rejected")}
          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-2 py-1 rounded border hover:bg-accent transition-colors text-muted-foreground"
        >
          {expanded ? "Hide note" : "Add note"}
        </button>
      </div>
    </div>
  );
}
