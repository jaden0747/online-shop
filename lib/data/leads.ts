import { readRows, writeRows, toStr, toNum } from "./excel";
import type { CustomerLead } from "./types";

const FILE = "leads.xlsx";
const SHEET = "Leads";

function parse(raw: Record<string, unknown>): CustomerLead {
  return {
    id: toStr(raw.id),
    source: toStr(raw.source),
    externalUserId: toStr(raw.externalUserId) || null,
    name: toStr(raw.name),
    phone: toStr(raw.phone),
    address: toStr(raw.address) || null,
    goal: toStr(raw.goal) || null,
    mealsPerDay: raw.mealsPerDay != null ? toNum(raw.mealsPerDay) : null,
    planInterest: toStr(raw.planInterest) || null,
    note: toStr(raw.note) || null,
    status: (toStr(raw.status) || "pending") as CustomerLead["status"],
    createdAt: toStr(raw.createdAt),
  };
}

function readAll(): CustomerLead[] {
  return readRows<Record<string, unknown>>(FILE, SHEET)
    .map(parse)
    .filter((l) => l.id && l.name && l.phone);
}

function saveAll(leads: CustomerLead[]): void {
  writeRows(FILE, SHEET, leads);
}

export function createLead(
  data: Omit<CustomerLead, "id" | "status" | "createdAt">
): CustomerLead {
  const lead: CustomerLead = {
    ...data,
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(lead);
  saveAll(all);
  return lead;
}

export function getAllLeads(): CustomerLead[] {
  return readAll();
}

export function getPendingLeads(): CustomerLead[] {
  return readAll().filter((l) => l.status === "pending");
}

export function updateLeadStatus(
  id: string,
  status: CustomerLead["status"]
): void {
  const all = readAll();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], status };
  saveAll(all);
}

export function updateLead(
  id: string,
  data: Partial<Pick<CustomerLead, "name" | "phone" | "address" | "goal" | "mealsPerDay" | "planInterest" | "note">>
): CustomerLead | null {
  const all = readAll();
  const idx = all.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...data };
  saveAll(all);
  return all[idx];
}

export function getLeadById(id: string): CustomerLead | null {
  return readAll().find((l) => l.id === id) ?? null;
}
