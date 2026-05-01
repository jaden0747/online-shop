"use server";

import { revalidatePath } from "next/cache";

// Cost tracking is not used in the current version of the app.
export async function createCost(_formData: FormData) {
  revalidatePath("/");
}

export async function deleteCost(_id: string) {
  revalidatePath("/");
}
