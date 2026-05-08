"use server";

import { revalidatePath } from "next/cache";
import { saveSettings } from "@/lib/data/settings";

export async function updateSettingsAction(formData: FormData) {
  const hubLat = parseFloat(formData.get("hubLat") as string);
  const hubLng = parseFloat(formData.get("hubLng") as string);
  if (isNaN(hubLat) || isNaN(hubLng)) return;
  saveSettings({ hubLat, hubLng });
  revalidatePath("/settings");
  revalidatePath("/shipping");
  revalidatePath("/route");
}
