import { readRows, writeRows, toStr } from "./excel";
import type { AssistantActionLog } from "./types";

const FILE = "assistant-log.xlsx";
const SHEET = "AssistantLog";

function parse(raw: Record<string, unknown>): AssistantActionLog {
  return {
    id: toStr(raw.id),
    source: toStr(raw.source),
    externalUserId: toStr(raw.externalUserId) || null,
    customerId: toStr(raw.customerId) || null,
    action: toStr(raw.action),
    request: safeJson(toStr(raw.request)),
    result: safeJson(toStr(raw.result)),
    createdAt: toStr(raw.createdAt),
  };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getAssistantLogs(limit = 200): AssistantActionLog[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((l) => l.id && l.action)
    .slice(-limit)
    .reverse();
}

export function appendAssistantLog(
  entry: Omit<AssistantActionLog, "id" | "createdAt">
): AssistantActionLog {
  const log: AssistantActionLog = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    request: entry.request,
    result: entry.result,
    createdAt: new Date().toISOString(),
  };

  const all = readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((l) => l.id && l.action);

  all.push(log);
  writeRows(
    FILE,
    SHEET,
    all.map((l) => ({
      ...l,
      request: JSON.stringify(l.request),
      result: JSON.stringify(l.result),
    }))
  );

  return log;
}
