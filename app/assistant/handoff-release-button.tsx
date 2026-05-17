"use client";

import { useTransition } from "react";
import { releaseHandoffAction } from "@/app/actions/assistant";

export function HandoffReleaseButton({
  channel,
  externalUserId,
}: {
  channel: string;
  externalUserId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(() => releaseHandoffAction(channel, externalUserId))
      }
      className="text-xs px-2 py-1 rounded bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
    >
      {isPending ? "Releasing…" : "Release"}
    </button>
  );
}
