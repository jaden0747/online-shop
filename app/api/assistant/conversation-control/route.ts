import { NextRequest, NextResponse } from "next/server";
import {
  getConversationControl,
  getAllConversationControls,
  setConversationControl,
  clearConversationControl,
} from "@/lib/data/conversation-control";
import { appendAssistantLog } from "@/lib/data/assistant-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const channel = searchParams.get("channel");
  const externalUserId = searchParams.get("externalUserId");

  if (!channel) {
    return NextResponse.json(
      { error: "channel is required" },
      { status: 400 }
    );
  }

  // List all active records for a channel when externalUserId is omitted
  if (!externalUserId) {
    const now = new Date();
    const active = getAllConversationControls().filter(
      (r) =>
        r.channel === channel &&
        r.mode === "human_active" &&
        r.lockExpiresAt != null &&
        new Date(r.lockExpiresAt) > now
    );
    return NextResponse.json({ active });
  }

  const state = getConversationControl(channel, externalUserId);
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  const source = req.headers.get("x-source") ?? "unknown";
  const externalUserIdHeader = req.headers.get("x-external-user-id") ?? null;

  let body: {
    channel?: string;
    externalUserId?: string;
    mode?: string;
    source?: string;
    ttlMinutes?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { channel, externalUserId, mode, source: lockSource, ttlMinutes } = body;

  if (!channel || !externalUserId || !mode) {
    return NextResponse.json(
      { error: "channel, externalUserId, and mode are required" },
      { status: 400 }
    );
  }

  if (mode !== "bot" && mode !== "human_active") {
    return NextResponse.json(
      { error: "mode must be 'bot' or 'human_active'" },
      { status: 400 }
    );
  }

  const validSources = ["human_outbound_zalo", "manager_app_action", "bot_escalation"];
  const resolvedSource: ConversationControlSource =
    lockSource && validSources.includes(lockSource)
      ? (lockSource as ConversationControlSource)
      : null;

  const record = setConversationControl({
    channel,
    externalUserId,
    mode: mode as "bot" | "human_active",
    source: resolvedSource,
    ttlMinutes,
  });

  appendAssistantLog({
    source,
    externalUserId: externalUserIdHeader ?? externalUserId,
    customerId: null,
    action: mode === "human_active" ? "handoff_activated" : "handoff_cleared",
    request: { channel, externalUserId, mode, source: lockSource, ttlMinutes },
    result: { lockExpiresAt: record.lockExpiresAt },
  });

  return NextResponse.json(record);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const source = req.headers.get("x-source") ?? "unknown";
  const channel = searchParams.get("channel");
  const externalUserId = searchParams.get("externalUserId");

  if (!channel || !externalUserId) {
    return NextResponse.json(
      { error: "channel and externalUserId are required" },
      { status: 400 }
    );
  }

  clearConversationControl(channel, externalUserId);

  appendAssistantLog({
    source,
    externalUserId,
    customerId: null,
    action: "handoff_cleared",
    request: { channel, externalUserId },
    result: { cleared: true },
  });

  return NextResponse.json({ cleared: true });
}

type ConversationControlSource = "human_outbound_zalo" | "manager_app_action" | "bot_escalation" | null;
