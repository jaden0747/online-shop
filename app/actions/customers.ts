"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  getAllCustomers,
  getAllAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips, getAllExtras } from "@/lib/data/subscriptions";
import { isSubscriptionLive } from "@/lib/utils/subscription";
import { getAllSelections } from "@/lib/data/selections";
import { getAllMenuItems } from "@/lib/data/menu";
import { getAllPricing } from "@/lib/data/pricing";
import { getNotesByCustomer } from "@/lib/data/notes";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import { getSettings, getMealPrices } from "@/lib/data/settings";
import { getAllPayments } from "@/lib/data/payments";
import { getCreditTransactionsByCustomer } from "@/lib/data/credits";
import { getAllLeads } from "@/lib/data/leads";
import { getConversationControl } from "@/lib/data/conversation-control";
import type { Customer, CustomerAddress, Subscription, SubscriptionExtra, Pricing, MealSkip, MealSelection, MenuItem, KitchenNote, OrderDayAddress, Payment, CreditTransaction } from "@/lib/data/types";

export async function createCustomerAction(formData: FormData) {
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const zone = formData.get("zone") as string;

  createCustomer({
    name: formData.get("name") as string,
    phone,
    address,
    zone,
    notes: (formData.get("notes") as string) || null,
  });

  // Parse optional "latitude, longitude" coordinates
  const coordsRaw = (formData.get("coordinates") as string | null)?.trim() ?? "";
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (coordsRaw) {
    const parts = coordsRaw.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      latitude = parts[0];
      longitude = parts[1];
    }
  }

  createAddress({
    customerId: phone,
    label: "Default",
    address,
    zone,
    isDefault: true,
    latitude,
    longitude,
  });

  revalidatePath("/customers");
}

export async function updateCustomerAction(id: string, formData: FormData) {
  updateCustomer(id, {
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    address: formData.get("address") as string,
    zone: formData.get("zone") as string,
    notes: (formData.get("notes") as string) || null,
  });
  const newPhone = formData.get("phone") as string;
  revalidatePath("/customers");
  revalidatePath(`/customers/${newPhone}`);
}

export async function deleteCustomerAction(id: string) {
  deleteCustomer(id);
  revalidatePath("/customers");
}

export async function getCustomerDetailsAction(customerId: string): Promise<{
  customer: Customer | null;
  addresses: CustomerAddress[];
  subscriptions: Subscription[];
  skipCounts: Record<string, number>;
  totalSpend: number;
  pricing: Pricing[];
  skips: MealSkip[];
  allSelections: MealSelection[];
  allMenuItems: MenuItem[];
  kitchenNotes: KitchenNote[];
  dayAddresses: OrderDayAddress[];
  hub: { lat: number; lng: number };
  mealPrices: Record<string, number>;
  payments: Payment[];
  extras: SubscriptionExtra[];
  creditTransactions: CreditTransaction[];
  externalUserId: string | null;
  handoffActive: boolean;
}> {
  const customer = getCustomerById(customerId);
  const addresses = getAllAddresses().filter((a) => a.customerId === customerId);
  const subscriptions = getAllSubscriptions().filter((s) => s.customerId === customerId);
  const allSkips = getAllSkips();
  const skipCounts: Record<string, number> = {};
  for (const sub of subscriptions) {
    skipCounts[sub.id] = allSkips.filter((sk) => sk.subscriptionId === sub.id).length;
  }
  const totalSpend = subscriptions.reduce((acc, s) => acc + s.subscriptionPrice + s.shippingPrice, 0);

  const pricing = getAllPricing();

  // Schedule data
  const subIds = new Set(subscriptions.map((s) => s.id));
  const skips = allSkips.filter((sk) => subIds.has(sk.subscriptionId));
  const allSelections = getAllSelections().filter((s) => subIds.has(s.subscriptionId));
  const allMenuItems = getAllMenuItems();
  const kitchenNotes = getNotesByCustomer(customerId);
  const dayAddresses = getAllOrderDayAddresses().filter((r) => subIds.has(r.subscriptionId));

  const settings = getSettings();
  const allPayments = getAllPayments();
  const payments = allPayments.filter((p) => subIds.has(p.subscriptionId));
  const extras = getAllExtras().filter((e) => subIds.has(e.subscriptionId));
  const creditTransactions = getCreditTransactionsByCustomer(customerId);

  const digitsOnly = customerId.replace(/\D/g, "");
  const lead = getAllLeads().find(
    (l) => l.externalUserId && l.phone.replace(/\D/g, "") === digitsOnly
  );
  const externalUserId = lead?.externalUserId ?? null;
  const handoff = externalUserId
    ? getConversationControl("zalouser", externalUserId)
    : null;
  const handoffActive =
    handoff?.mode === "human_active" &&
    handoff.lockExpiresAt != null &&
    new Date(handoff.lockExpiresAt) > new Date();

  return { customer, addresses, subscriptions, skipCounts, totalSpend, pricing, skips, allSelections, allMenuItems, kitchenNotes, dayAddresses, hub: { lat: settings.hubLat, lng: settings.hubLng }, mealPrices: getMealPrices(settings), payments, extras, creditTransactions, externalUserId, handoffActive };
}

export async function updateCustomerNoteAction(id: string, notes: string | null) {
  const customer = getCustomerById(id);
  if (!customer) return;
  updateCustomer(id, { ...customer, notes });
  revalidatePath("/customers");
}

export async function updateCustomerInfoAction(
  id: string,
  data: { name: string; phone: string; zone: string }
): Promise<{ newId: string }> {
  const customer = getCustomerById(id);
  if (!customer) return { newId: id };
  updateCustomer(id, { ...customer, ...data });
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  revalidatePath("/shipping");
  return { newId: data.phone };
}

export async function addAddressAction(data: {
  customerId: string;
  label: string;
  address: string;
  zone: string;
  isDefault: boolean;
}) {
  createAddress(data);
  revalidatePath("/customers");
  revalidatePath("/shipping");
}

export async function updateAddressFieldsAction(
  id: string,
  data: { label: string; address: string; zone: string }
) {
  updateAddress(id, data);
  revalidatePath("/customers");
  revalidatePath("/shipping");
}

export async function deleteAddressAction(id: string) {
  deleteAddress(id);
  revalidatePath("/customers");
  revalidatePath("/shipping");
}

export async function setDefaultAddressAction(addressId: string, customerId: string) {
  setDefaultAddress(addressId, customerId);
  revalidatePath("/customers");
  revalidatePath("/shipping");
}

export async function getAllCustomersForSearchAction(): Promise<{
  id: string;
  name: string;
  phone: string;
  zone: string;
  hasActiveSub: boolean;
}[]> {
  const customers = getAllCustomers();
  const subscriptions = getAllSubscriptions();
  const activeIds = new Set(
    subscriptions
      .filter((s) => isSubscriptionLive(s.status, s.startDate, s.endDate))
      .map((s) => s.customerId)
  );
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    zone: c.zone,
    hasActiveSub: activeIds.has(c.id),
  }));
}
