import { readRows, writeRows, toStr, toStrOrNull, toNum } from "./excel";
import type { Order, OrderItem } from "./types";

const FILE = "orders.xlsx";
const SHEET_O = "Orders";
const SHEET_I = "OrderItems";

function parseOrder(raw: Record<string, unknown>): Order {
  return {
    id: toStr(raw.id),
    subscriptionId: toStr(raw.subscriptionId),
    weekLabel: toStr(raw.weekLabel),
    status: toStr(raw.status) || "pending",
    addressId: toStrOrNull(raw.addressId),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

function parseItem(raw: Record<string, unknown>): OrderItem {
  return {
    id: toStr(raw.id),
    orderId: toStr(raw.orderId),
    day: toNum(raw.day),
    mealSlot: toNum(raw.mealSlot) || 1,
    menuItemId: toStrOrNull(raw.menuItemId),
    quantity: toNum(raw.quantity) || 1,
    notes: toStrOrNull(raw.notes),
  };
}

export function getAllOrders(): Order[] {
  return readRows<Record<string, unknown>>(FILE, SHEET_O)
    .map(parseOrder)
    .filter((o) => o.id && o.subscriptionId);
}

export function getAllOrderItems(): OrderItem[] {
  return readRows<Record<string, unknown>>(FILE, SHEET_I)
    .map(parseItem)
    .filter((i) => i.id && i.orderId);
}

export function getOrdersBySubscription(subscriptionId: string): Order[] {
  return getAllOrders().filter((o) => o.subscriptionId === subscriptionId);
}

export function getItemsByOrder(orderId: string): OrderItem[] {
  return getAllOrderItems().filter((i) => i.orderId === orderId);
}

export function saveOrders(orders: Order[]): void {
  writeRows(FILE, SHEET_O, orders);
}

export function saveOrderItems(items: OrderItem[]): void {
  writeRows(FILE, SHEET_I, items);
}

export function createOrder(data: {
  subscriptionId: string;
  weekLabel: string;
  addressId?: string | null;
}): Order {
  const orders = getAllOrders();
  const order: Order = {
    id: crypto.randomUUID(),
    subscriptionId: data.subscriptionId,
    weekLabel: data.weekLabel,
    status: "pending",
    addressId: data.addressId ?? null,
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  saveOrders(orders);
  return order;
}

export function updateOrderStatus(id: string, status: string): void {
  saveOrders(getAllOrders().map((o) => (o.id === id ? { ...o, status } : o)));
}

export function setOrderMeals(
  orderId: string,
  selections: {
    day: number;
    mealSlot: number;
    menuItemId: string | null;
    quantity?: number;
    notes?: string | null;
  }[],
  addressId?: string | null
): void {
  // Update order address
  const orders = getAllOrders().map((o) => {
    if (o.id !== orderId) return o;
    return {
      ...o,
      addressId: addressId !== undefined ? (addressId ?? null) : o.addressId,
    };
  });
  saveOrders(orders);

  // Replace order items
  const existingItems = getAllOrderItems().filter((i) => i.orderId !== orderId);
  const newItems: OrderItem[] = selections.map((s) => ({
    id: crypto.randomUUID(),
    orderId,
    day: s.day,
    mealSlot: s.mealSlot,
    menuItemId: s.menuItemId ?? null,
    quantity: s.quantity ?? 1,
    notes: s.notes ?? null,
  }));
  saveOrderItems([...existingItems, ...newItems]);
}

export function updateOrderAddress(id: string, addressId: string | null): void {
  saveOrders(getAllOrders().map((o) => (o.id === id ? { ...o, addressId } : o)));
}

export function deleteOrdersBySubscription(subscriptionId: string): void {
  const orders = getAllOrders();
  const toDelete = new Set(
    orders.filter((o) => o.subscriptionId === subscriptionId).map((o) => o.id)
  );
  saveOrders(orders.filter((o) => !toDelete.has(o.id)));
  saveOrderItems(getAllOrderItems().filter((i) => !toDelete.has(i.orderId)));
}
