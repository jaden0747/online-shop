"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  getAllAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/data/customers";
import { getAllSubscriptions, getAllSkips } from "@/lib/data/subscriptions";
import { getAllSelections } from "@/lib/data/selections";
import { getAllMenuItems } from "@/lib/data/menu";
import { getAllPricing } from "@/lib/data/pricing";
import { getAllOrders } from "@/lib/data/orders";
import { getNotesByCustomer } from "@/lib/data/notes";
import { getAllOrderDayAddresses } from "@/lib/data/order-day-addresses";
import type { Customer, CustomerAddress, Subscription, Pricing, MealSkip, MealSelection, MenuItem, Order, KitchenNote, OrderDayAddress } from "@/lib/data/types";

export async function createCustomerAction(formData: FormData) {
  createCustomer({
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    address: formData.get("address") as string,
    zone: formData.get("zone") as string,
    notes: (formData.get("notes") as string) || null,
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
  orders: Order[];
  kitchenNotes: KitchenNote[];
  dayAddresses: OrderDayAddress[];
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
  const allSelections = getAllSelections().filter((s) => s.customerId === customerId);
  const allMenuItems = getAllMenuItems();
  const orders = getAllOrders().filter((o) => subIds.has(o.subscriptionId));
  const kitchenNotes = getNotesByCustomer(customerId);
  const dayAddresses = getAllOrderDayAddresses().filter((r) => subIds.has(r.subscriptionId));

  return { customer, addresses, subscriptions, skipCounts, totalSpend, pricing, skips, allSelections, allMenuItems, orders, kitchenNotes, dayAddresses };
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
