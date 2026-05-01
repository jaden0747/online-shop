/**
 * One-time script: create a weekly/cutting/1-meal subscription for every customer
 * starting April 1, 2026. Skips customers who already have any subscription.
 *
 * Usage: node scripts/seed-subscriptions.mjs
 */

import XLSX from "xlsx";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");

function readSheet(file, sheet) {
  const p = path.join(DATA_DIR, file);
  if (!existsSync(p)) return [];
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets[sheet] ?? wb.Sheets[wb.SheetNames[0]];
  return ws ? XLSX.utils.sheet_to_json(ws) : [];
}

function writeSheet(file, sheet, rows) {
  const p = path.join(DATA_DIR, file);
  let wb;
  if (existsSync(p)) {
    wb = XLSX.readFile(p);
  } else {
    wb = XLSX.utils.book_new();
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  if (wb.SheetNames.includes(sheet)) {
    wb.Sheets[sheet] = ws;
  } else {
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }
  XLSX.writeFile(wb, p);
}

const customers = readSheet("customers.xlsx", "Customers").filter((r) => r.phone);
const existing = readSheet("subscriptions.xlsx", "Subscriptions").filter((r) => r.id && r.customerId);

const existingCustomerIds = new Set(existing.map((s) => s.customerId));

const START = "2026-04-01T00:00:00.000Z";
const RENEWAL = "2026-04-08T00:00:00.000Z"; // +7 days
const PACKAGE_PRICE = 250000;
const PRICE_PER_MEAL = 50000; // 250000 / 5 days

const newSubs = [];
for (const c of customers) {
  if (existingCustomerIds.has(c.phone)) {
    console.log(`  skip  ${c.name} (${c.phone}) — already has subscription`);
    continue;
  }
  newSubs.push({
    id: randomUUID(),
    customerId: c.phone,
    plan: "weekly",
    goal: "cutting",
    mealsPerDay: 1,
    status: "active",
    packagePrice: PACKAGE_PRICE,
    pricePerMeal: PRICE_PER_MEAL,
    startDate: START,
    renewalDate: RENEWAL,
    cancelReason: null,
    createdAt: new Date().toISOString(),
  });
  console.log(`  add   ${c.name} (${c.phone})`);
}

if (newSubs.length === 0) {
  console.log("\nNothing to do — all customers already have subscriptions.");
} else {
  writeSheet("subscriptions.xlsx", "Subscriptions", [...existing, ...newSubs]);
  console.log(`\nDone — created ${newSubs.length} subscription(s).`);
}
