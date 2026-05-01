"use server";

import { revalidatePath } from "next/cache";
import {
  createAddress,
  setDefaultAddress,
  deleteAddress,
  updateAddress,
} from "@/lib/data/customers";

function parseCoords(val: string | null): { latitude: number | null; longitude: number | null } {
  if (!val?.trim()) return { latitude: null, longitude: null };
  const m = val.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (!m) return { latitude: null, longitude: null };
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
}

export async function createAddressAction(formData: FormData) {
  const customerId = formData.get("customerId") as string;
  const coords = parseCoords(formData.get("coordinates") as string);
  createAddress({
    customerId,
    label: formData.get("label") as string,
    address: formData.get("address") as string,
    zone: formData.get("zone") as string,
    isDefault: formData.get("isDefault") === "true",
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
  revalidatePath(`/customers/${customerId}`);
}

export async function updateAddressCoordinatesAction(
  id: string,
  customerId: string,
  latitude: number | null,
  longitude: number | null
) {
  updateAddress(id, { latitude, longitude });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/addresses");
  revalidatePath("/shipping");
  revalidatePath("/route");
}

export async function updateAddressCoordsStringAction(
  id: string,
  customerId: string,
  coordsStr: string
) {
  const coords = parseCoords(coordsStr);
  updateAddress(id, { latitude: coords.latitude, longitude: coords.longitude });
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/addresses");
  revalidatePath("/shipping");
  revalidatePath("/route");
}

export async function setDefaultAddressAction(id: string, customerId: string) {
  setDefaultAddress(id, customerId);
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteAddressAction(id: string, customerId: string) {
  deleteAddress(id);
  revalidatePath(`/customers/${customerId}`);
}
