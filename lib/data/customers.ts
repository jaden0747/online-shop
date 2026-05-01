import { readRows, writeRows, toStr, toStrOrNull, toBool, toNum } from "./excel";
import type { Customer, CustomerAddress } from "./types";

const CUST_FILE = "customers.xlsx";
const ADDR_FILE = "addresses.xlsx";
const SHEET_C = "Customers";
const SHEET_A = "Addresses";

function parseCustomer(raw: Record<string, unknown>): Customer {
  const phone = toStr(raw.phone);
  return {
    id: phone,
    name: toStr(raw.name),
    phone,
    address: toStr(raw.address),
    zone: toStr(raw.zone),
    notes: toStrOrNull(raw.notes),
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

function parseAddress(raw: Record<string, unknown>): CustomerAddress {
  return {
    id: toStr(raw.id),
    customerId: toStr(raw.customerId),
    label: toStr(raw.label),
    address: toStr(raw.address),
    zone: toStr(raw.zone),
    isDefault: toBool(raw.isDefault),
    latitude: raw.latitude !== null && raw.latitude !== undefined && raw.latitude !== "" ? toNum(raw.latitude) : null,
    longitude: raw.longitude !== null && raw.longitude !== undefined && raw.longitude !== "" ? toNum(raw.longitude) : null,
    createdAt: toStr(raw.createdAt) || new Date().toISOString(),
  };
}

export function getAllCustomers(): Customer[] {
  return readRows<Record<string, unknown>>(CUST_FILE, SHEET_C)
    .map(parseCustomer)
    .filter((c) => c.phone);
}

export function getAllAddresses(): CustomerAddress[] {
  return readRows<Record<string, unknown>>(ADDR_FILE, SHEET_A)
    .map(parseAddress)
    .filter((a) => a.id && a.customerId);
}

export function getCustomerById(id: string): Customer | null {
  return getAllCustomers().find((c) => c.id === id || c.phone === id) ?? null;
}

export function saveCustomers(customers: Customer[]): void {
  writeRows(CUST_FILE, SHEET_C, customers);
}

export function saveAddresses(addresses: CustomerAddress[]): void {
  writeRows(ADDR_FILE, SHEET_A, addresses);
}

export function createCustomer(data: {
  name: string;
  phone: string;
  address: string;
  zone: string;
  notes?: string | null;
}): Customer {
  const customers = getAllCustomers();
  const customer: Customer = {
    ...data,
    id: data.phone,
    notes: data.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  customers.unshift(customer);
  saveCustomers(customers);
  return customer;
}

export function updateCustomer(
  id: string,
  data: { name: string; phone: string; address: string; zone: string; notes?: string | null }
): void {
  const customers = getAllCustomers();
  const idx = customers.findIndex((c) => c.id === id || c.phone === id);
  if (idx === -1) return;
  const old = customers[idx];
  customers[idx] = {
    ...old,
    ...data,
    id: data.phone,
    notes: data.notes ?? null,
  };
  saveCustomers(customers);

  // Cascade phone change to addresses
  if (data.phone !== old.phone) {
    const addresses = getAllAddresses().map((a) =>
      a.customerId === old.phone ? { ...a, customerId: data.phone } : a
    );
    saveAddresses(addresses);
  }
}

export function deleteCustomer(id: string): void {
  saveCustomers(getAllCustomers().filter((c) => c.id !== id && c.phone !== id));
  saveAddresses(getAllAddresses().filter((a) => a.customerId !== id));
}

export function createAddress(data: {
  customerId: string;
  label: string;
  address: string;
  zone: string;
  isDefault: boolean;
  latitude?: number | null;
  longitude?: number | null;
}): CustomerAddress {
  const addresses = getAllAddresses();
  let updated = addresses;
  if (data.isDefault) {
    updated = addresses.map((a) =>
      a.customerId === data.customerId ? { ...a, isDefault: false } : a
    );
  }
  const addr: CustomerAddress = {
    id: crypto.randomUUID(),
    ...data,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    createdAt: new Date().toISOString(),
  };
  updated.push(addr);
  saveAddresses(updated);
  return addr;
}

export function updateAddress(
  id: string,
  data: Partial<Pick<CustomerAddress, "label" | "address" | "zone" | "latitude" | "longitude">>
): void {
  const addresses = getAllAddresses();
  const idx = addresses.findIndex((a) => a.id === id);
  if (idx === -1) return;
  addresses[idx] = { ...addresses[idx], ...data };
  saveAddresses(addresses);
}

export function setDefaultAddress(id: string, customerId: string): void {
  const addresses = getAllAddresses().map((a) => {
    if (a.customerId !== customerId) return a;
    return { ...a, isDefault: a.id === id };
  });
  saveAddresses(addresses);
}

export function deleteAddress(id: string): void {
  saveAddresses(getAllAddresses().filter((a) => a.id !== id));
}
