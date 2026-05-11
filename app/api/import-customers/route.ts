import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  getAllCustomers,
  getAllAddresses,
  saveCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  createAddress,
} from "@/lib/data/customers";
import { getAllSubscriptions, createSubscription } from "@/lib/data/subscriptions";
import { getAllPricing } from "@/lib/data/pricing";
import { addWorkingDays } from "@/lib/utils/subscription";
import { revalidatePath } from "next/cache";

const VALID_PLANS = ["trial", "weekly", "monthly"];
const VALID_GOALS = ["cutting", "maintenance", "bulking", "keto"];

/** Lower-case, collapse spaces/slashes/dots into underscores, strip trailing underscores. */
function normalizeKey(k: string): string {
  return k.toLowerCase().trim().replace(/[\s/.\-]+/g, "_").replace(/_+/g, "_").replace(/_$/, "");
}

function normalizeHeaders(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = String(v ?? "").trim();
  }
  return out;
}

function get(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[normalizeKey(k)];
    if (v) return v;
  }
  return "";
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const m1 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  // Excel serial number (days since 1900-01-01)
  const n = Number(val);
  if (!isNaN(n) && n > 40000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

function planDurationDays(plan: string): number {
  if (plan === "monthly") return 19;
  if (plan === "weekly") return 4;
  return 2; // trial default (trialDays - 1)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const mode = (formData.get("mode") as string) ?? "new"; // "new" | "upsert" | "override"

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  let created = 0, updated = 0, skipped = 0, deleted = 0;
  const errors: string[] = [];

  const phonesInFile = new Set<string>();
  for (const rawRow of rawRows) {
    const row = normalizeHeaders(rawRow);
    const phone = get(row, "phone number", "phone");
    if (phone) phonesInFile.add(phone);
  }

  const existingCustomers = getAllCustomers();
  const existingAddresses = getAllAddresses();
  const existingSubscriptions = getAllSubscriptions();
  const pricingEntries = getAllPricing();

  for (const rawRow of rawRows) {
    const row = normalizeHeaders(rawRow);

    const name    = get(row, "name");
    const phone   = get(row, "phone number", "phone");
    const address = get(row, "default address", "address");
    const zone    = get(row, "zone");

    if (!name || !phone || !address || !zone) {
      errors.push(`Skipped — missing required fields (name/phone/address/zone) on row for "${name || phone}"`);
      skipped++;
      continue;
    }

    try {
      const existing = existingCustomers.find((c) => c.phone === phone);

      if (existing && mode === "new") {
        skipped++;
        continue;
      } else if (existing && (mode === "upsert" || mode === "override")) {
        updateCustomer(phone, { name, phone, address, zone, notes: get(row, "notes") || null });
        updated++;
      } else if (!existing) {
        createCustomer({ name, phone, address, zone, notes: get(row, "notes") || null });
        created++;
      }

      // Alt address
      const altAddress = get(row, "alt address", "alt. address", "alternative address");
      if (altAddress && altAddress !== address) {
        const existingAlt = existingAddresses.find(
          (a) => a.customerId === phone && a.address === altAddress
        );
        if (!existingAlt) {
          createAddress({ customerId: phone, label: "Alt", address: altAddress, zone, isDefault: false });
        }
      }

      // Subscription (optional)
      const plan = get(row, "subscription type", "subscription_type", "plan").toLowerCase();
      const goal = get(row, "subscription goal", "subscription_goal", "goal").toLowerCase();
      const mealsPerDay = parseInt(get(row, "meals / day", "meals per day", "meals_per_day") || "1", 10) || 1;
      const skipDays    = parseInt(get(row, "skip days used", "skip_days_used", "skip days") || "0", 10) || 0;

      if (VALID_PLANS.includes(plan) && VALID_GOALS.includes(goal)) {
        const activeSub = existingSubscriptions.find(
          (s) => s.customerId === phone && s.status !== "cancelled"
        );
        if (!activeSub) {
          const startDate   = parseDate(get(row, "start date", "start_date")) ?? new Date();
          const duration    = planDurationDays(plan);
          const endDate = addWorkingDays(startDate, duration + skipDays);

          const pricing           = pricingEntries.find((p: { plan: string; goal: string; mealsPerDay: number; totalPrice: number }) => p.plan === plan && p.goal === goal && p.mealsPerDay === mealsPerDay);
          const subscriptionPrice = pricing?.totalPrice ?? 0;

          createSubscription({
            customerId: phone,
            plan, goal, mealsPerDay,
            subscriptionPrice,
            shippingPrice: 0,
            discount: 0,
            trialDays: plan === "trial" ? duration : null,
            status: "active",
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            endDateNoSkip: endDate.toISOString(),
            cancelReason: null,
            addressId: null,
          });
        }
      }
    } catch (e) {
      errors.push(`Error on "${phone}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Override: remove customers whose phone was NOT in the file
  if (mode === "override") {
    const toDelete = existingCustomers.filter((c) => !phonesInFile.has(c.phone));
    for (const c of toDelete) {
      deleteCustomer(c.phone);
      deleted++;
    }
  }

  revalidatePath("/customers");
  return NextResponse.json({ created, updated, skipped, deleted, errors });
}
