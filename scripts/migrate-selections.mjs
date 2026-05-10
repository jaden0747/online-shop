/**
 * One-time migration: rekey selections.xlsx from customerId to subscriptionId.
 *
 * Old ID format: ${weekLabel}-${customerId}-${day}-${mealNum}
 * New ID format: ${weekLabel}-${subscriptionId}-${day}-${mealNum}
 *
 * Tie-break (when multiple subs overlap the week for a customer): pick the sub
 * with the earliest startDate. This treats existing selections as belonging to
 * the customer's longest-running/base subscription.
 *
 * Rows with no matching subscription are dropped.
 *
 * Usage: node scripts/migrate-selections.mjs [--dry-run]
 */

import XLSX from "xlsx";
import { existsSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const DRY_RUN = process.argv.includes("--dry-run");

function readSheet(file, sheet) {
  const p = path.join(DATA_DIR, file);
  if (!existsSync(p)) return [];
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets[sheet] ?? wb.Sheets[wb.SheetNames[0]];
  return ws ? XLSX.utils.sheet_to_json(ws) : [];
}

function writeSheet(file, sheet, rows) {
  const p = path.join(DATA_DIR, file);
  const wb = existsSync(p) ? XLSX.readFile(p) : XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  if (wb.SheetNames.includes(sheet)) {
    wb.Sheets[sheet] = ws;
  } else {
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  }
  XLSX.writeFile(wb, p);
}

// Parse Excel serial date or ISO string to YYYY-MM-DD
function toDateStr(raw) {
  if (!raw) return null;
  if (typeof raw === "number") {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
    return d.toISOString().split("T")[0];
  }
  const s = String(raw);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

// Week label → Monday ISO date string
function weekLabelToMonday(weekLabel) {
  const m = weekLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO week 1 is the week containing Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=Mon
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1) + (week - 1) * 7);
  return monday.toISOString().split("T")[0];
}

function weekContainsDay(weekLabel, dateStr) {
  const monday = weekLabelToMonday(weekLabel);
  if (!monday) return false;
  const fridayDate = new Date(monday + "T00:00:00Z");
  fridayDate.setUTCDate(fridayDate.getUTCDate() + 4);
  const friday = fridayDate.toISOString().split("T")[0];
  return dateStr >= monday && dateStr <= friday;
}

// Load data
const rawSelections = readSheet("selections.xlsx", "Selections");
const subscriptions = readSheet("subscriptions.xlsx", "Subscriptions")
  .filter((s) => s.id && s.customerId);

console.log(`Loaded ${rawSelections.length} selections, ${subscriptions.length} subscriptions`);

// Build customerId → subscriptions map
const subsByCustomer = new Map();
for (const sub of subscriptions) {
  const list = subsByCustomer.get(sub.customerId) ?? [];
  list.push(sub);
  subsByCustomer.set(sub.customerId, list);
}

let kept = 0;
let dropped = 0;
let alreadyMigrated = 0;

const newSelections = [];

for (const row of rawSelections) {
  // Check if already migrated: subscriptionId field present and non-empty
  if (row.subscriptionId && !row.customerId) {
    alreadyMigrated++;
    newSelections.push(row);
    continue;
  }

  const customerId = String(row.customerId ?? "").trim();
  const weekLabel = String(row.weekLabel ?? "").trim();
  const day = Number(row.day);
  const mealNum = Number(row.mealNum) || 1;
  const menuSlot = Number(row.menuSlot) || 1;

  if (!customerId || !weekLabel) {
    dropped++;
    console.log(`  DROP  missing customerId/weekLabel: ${JSON.stringify(row)}`);
    continue;
  }

  const customerSubs = subsByCustomer.get(customerId) ?? [];

  // Find subs that overlap this week
  const overlapping = customerSubs.filter((sub) => {
    const startStr = toDateStr(sub.startDate);
    const endStr = toDateStr(sub.endDate);
    if (!startStr || !endStr) return false;
    const monday = weekLabelToMonday(weekLabel);
    const fridayDate = new Date(monday + "T00:00:00Z");
    fridayDate.setUTCDate(fridayDate.getUTCDate() + 4);
    const friday = fridayDate.toISOString().split("T")[0];
    // Subscription overlaps week if startDate <= friday AND endDate >= monday
    return startStr <= friday && endStr >= monday;
  });

  if (overlapping.length === 0) {
    dropped++;
    console.log(`  DROP  no sub for customer ${customerId} covering week ${weekLabel}`);
    continue;
  }

  // Tie-break: earliest startDate
  overlapping.sort((a, b) => {
    const aStr = toDateStr(a.startDate) ?? "";
    const bStr = toDateStr(b.startDate) ?? "";
    return aStr.localeCompare(bStr);
  });

  const sub = overlapping[0];
  const newId = `${weekLabel}-${sub.id}-${day}-${mealNum}`;

  newSelections.push({
    id: newId,
    weekLabel,
    subscriptionId: sub.id,
    day,
    mealNum,
    menuSlot,
  });

  kept++;
  if (overlapping.length > 1) {
    console.log(`  WARN  multiple subs for ${customerId} week ${weekLabel} — picked earliest (${sub.id})`);
  }
}

console.log(`\nResult: ${kept} migrated, ${alreadyMigrated} already migrated, ${dropped} dropped`);

if (DRY_RUN) {
  console.log("\n[dry-run] No files written.");
} else {
  // Backup original
  const selPath = path.join(DATA_DIR, "selections.xlsx");
  if (existsSync(selPath)) {
    const backupPath = selPath.replace(".xlsx", `.backup-${Date.now()}.xlsx`);
    copyFileSync(selPath, backupPath);
    console.log(`Backed up to ${backupPath}`);
  }

  writeSheet("selections.xlsx", "Selections", newSelections);
  console.log("Done — selections.xlsx updated.");
}
