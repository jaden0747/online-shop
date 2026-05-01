"use server";

import { revalidatePath } from "next/cache";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/data/customers";

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
