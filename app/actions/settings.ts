"use server";

import { revalidatePath } from "next/cache";
import { getSettings, saveSettings } from "@/lib/data/settings";

export async function updateSettingsAction(formData: FormData) {
  const hubLat = parseFloat(formData.get("hubLat") as string);
  const hubLng = parseFloat(formData.get("hubLng") as string);
  if (isNaN(hubLat) || isNaN(hubLng)) return;
  const current = getSettings();
  saveSettings({ ...current, hubLat, hubLng });
  revalidatePath("/settings");
  revalidatePath("/shipping");
  revalidatePath("/route");
}

export async function updateMealPriceAction(formData: FormData) {
  const current = getSettings();
  const parse = (key: string) => {
    const v = parseFloat(formData.get(key) as string);
    return isNaN(v) || v < 0 ? 0 : v;
  };
  saveSettings({
    ...current,
    mealPriceCutting: parse("mealPriceCutting"),
    mealPriceMaintenance: parse("mealPriceMaintenance"),
    mealPriceBulking: parse("mealPriceBulking"),
    mealPriceKeto: parse("mealPriceKeto"),
  });
  revalidatePath("/settings");
  revalidatePath("/subscriptions");
}

export async function updateShippingFeeAction(formData: FormData) {
  const current = getSettings();
  const parsePos = (key: string, fallback: number) => {
    const v = parseFloat(formData.get(key) as string);
    return isNaN(v) || v < 0 ? fallback : v;
  };
  saveSettings({
    ...current,
    shippingFeeZone1MaxKm: parsePos("zone1MaxKm", current.shippingFeeZone1MaxKm),
    shippingFeeZone1: parsePos("zone1", current.shippingFeeZone1),
    shippingFeeZone2MaxKm: parsePos("zone2MaxKm", current.shippingFeeZone2MaxKm),
    shippingFeeZone2: parsePos("zone2", current.shippingFeeZone2),
    shippingFeeZone3MaxKm: parsePos("zone3MaxKm", current.shippingFeeZone3MaxKm),
    shippingFeeZone3: parsePos("zone3", current.shippingFeeZone3),
    shippingFeeZone4PerKm: parsePos("zone4PerKm", current.shippingFeeZone4PerKm),
  });
  revalidatePath("/settings");
}

export async function updateFormulaSettingsAction(data: {
  basePricePerMeal: number;
  goalMultiplierCutting: number;
  goalMultiplierMaintenance: number;
  goalMultiplierBulking: number;
  goalMultiplierKeto: number;
}): Promise<void> {
  const current = getSettings();
  saveSettings({ ...current, ...data });
  revalidatePath("/settings");
}
