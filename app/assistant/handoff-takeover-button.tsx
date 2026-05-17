"use client";

import { useTransition } from "react";
import { takeOverHandoffAction } from "@/app/actions/assistant";

export function HandoffTakeoverButton({
  channel,
  externalUserId,
  label = "Take Over",
}: {
  channel: string;
  externalUserId: string | null;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending || !externalUserId}
      title={!externalUserId ? "No Zalo ID yet — customer must message the bot first" : undefined}
      onClick={() => {
        if (externalUserId) startTransition(() => takeOverHandoffAction(channel, externalUserId));
      }}
      className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Setting…" : label}
    </button>
  );
}
