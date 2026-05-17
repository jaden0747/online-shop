import { readRows, writeRows, toStr } from "./excel";
import type { ConversationControl } from "./types";

const FILE = "conversation-control.xlsx";
const SHEET = "ConversationControl";

const HANDOFF_TTL_MINUTES = 120;

function parse(raw: Record<string, unknown>): ConversationControl {
  return {
    id: toStr(raw.id),
    channel: toStr(raw.channel),
    externalUserId: toStr(raw.externalUserId),
    mode: (toStr(raw.mode) as ConversationControl["mode"]) || "bot",
    source: (toStr(raw.source) as ConversationControl["source"]) || null,
    lastHumanMessageAt: toStr(raw.lastHumanMessageAt) || null,
    lockExpiresAt: toStr(raw.lockExpiresAt) || null,
    updatedAt: toStr(raw.updatedAt),
  };
}

function makeId(channel: string, externalUserId: string): string {
  return `${channel}:${externalUserId}`;
}

function isExpired(record: ConversationControl): boolean {
  if (!record.lockExpiresAt) return true;
  return new Date(record.lockExpiresAt) <= new Date();
}

export function getConversationControl(
  channel: string,
  externalUserId: string
): ConversationControl {
  const id = makeId(channel, externalUserId);
  const all = readRows<Record<string, unknown>>(FILE, SHEET).map(parse);
  const found = all.find((r) => r.id === id);

  if (!found || isExpired(found)) {
    return {
      id,
      channel,
      externalUserId,
      mode: "bot",
      source: null,
      lastHumanMessageAt: null,
      lockExpiresAt: null,
      updatedAt: new Date().toISOString(),
    };
  }

  return found;
}

export function setConversationControl(opts: {
  channel: string;
  externalUserId: string;
  mode: ConversationControl["mode"];
  source: ConversationControl["source"];
  ttlMinutes?: number;
}): ConversationControl {
  const id = makeId(opts.channel, opts.externalUserId);
  const now = new Date();
  const ttl = opts.ttlMinutes ?? HANDOFF_TTL_MINUTES;
  const lockExpiresAt = new Date(now.getTime() + ttl * 60 * 1000).toISOString();

  const record: ConversationControl = {
    id,
    channel: opts.channel,
    externalUserId: opts.externalUserId,
    mode: opts.mode,
    source: opts.source,
    lastHumanMessageAt: opts.source === "human_outbound_zalo" ? now.toISOString() : null,
    lockExpiresAt: opts.mode === "human_active" ? lockExpiresAt : null,
    updatedAt: now.toISOString(),
  };

  const all = readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((r) => r.id && r.channel);
  const idx = all.findIndex((r) => r.id === id);
  if (idx >= 0) {
    all[idx] = record;
  } else {
    all.push(record);
  }

  writeRows(FILE, SHEET, all);
  return record;
}

export function getAllConversationControls(): ConversationControl[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((r) => r.id && r.channel);
}

export function clearConversationControl(
  channel: string,
  externalUserId: string
): void {
  const id = makeId(channel, externalUserId);
  const remaining = readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((r) => r.id && r.channel && r.id !== id);
  writeRows(FILE, SHEET, remaining);
}
