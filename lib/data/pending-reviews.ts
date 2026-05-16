import { readRows, writeRows, toStr } from "./excel";
import type { PendingReview } from "./types";

const FILE = "pending-reviews.xlsx";
const SHEET = "PendingReviews";

function parse(raw: Record<string, unknown>): PendingReview {
  return {
    id: toStr(raw.id),
    type: toStr(raw.type) as PendingReview["type"],
    source: toStr(raw.source),
    externalUserId: toStr(raw.externalUserId) || null,
    customerId: toStr(raw.customerId) || null,
    subscriptionId: toStr(raw.subscriptionId) || null,
    payload: safeJson(toStr(raw.payload)),
    status: (toStr(raw.status) || "pending") as PendingReview["status"],
    managerNote: toStr(raw.managerNote) || null,
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

function readAll(): PendingReview[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((r) => r.id && r.type);
}

function saveAll(reviews: PendingReview[]): void {
  writeRows(
    FILE,
    SHEET,
    reviews.map((r) => ({ ...r, payload: JSON.stringify(r.payload) }))
  );
}

export function createPendingReview(
  data: Omit<PendingReview, "id" | "status" | "createdAt">
): PendingReview {
  const review: PendingReview = {
    ...data,
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(review);
  saveAll(all);
  return review;
}

export function getAllPendingReviews(): PendingReview[] {
  return readAll();
}

export function getPendingReviews(): PendingReview[] {
  return readAll().filter((r) => r.status === "pending");
}

export function updateReviewStatus(
  id: string,
  status: PendingReview["status"],
  managerNote?: string
): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], status, managerNote: managerNote ?? all[idx].managerNote };
  saveAll(all);
}
