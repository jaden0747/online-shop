import { NextRequest, NextResponse } from "next/server";
import { saveCustomers, saveAddresses } from "@/lib/data/customers";
import { saveSubscriptions, saveSkips } from "@/lib/data/subscriptions";
import { saveMenuItems } from "@/lib/data/menu";
import { saveOrders, saveOrderItems } from "@/lib/data/orders";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "DELETE ALL DATA") {
    return NextResponse.json({ error: "Confirmation phrase mismatch" }, { status: 400 });
  }

  // Clear all data files (pricing is kept — it's configuration, not operational data)
  saveCustomers([]);
  saveAddresses([]);
  saveSubscriptions([]);
  saveSkips([]);
  saveMenuItems([]);
  saveOrders([]);
  saveOrderItems([]);

  for (const path of ["/customers", "/menu", "/subscriptions"]) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true });
}
