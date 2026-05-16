/**
 * Canonical meal-selection business logic shared by server actions and the assistant API.
 * Contains no Next.js dependencies.
 */

import { upsertSelection, deleteSelection } from "@/lib/data/selections";
import { getSubscriptionById } from "@/lib/data/subscriptions";
import { getMenuItemsByWeek } from "@/lib/data/menu";
import type { MealSelection } from "@/lib/data/types";

export type SelectionValidationError =
  | "subscription_not_found"
  | "subscription_not_active"
  | "invalid_day"
  | "invalid_meal_num"
  | "invalid_menu_slot"
  | "menu_not_found";

export function validateAndUpsertSelection(data: {
  weekLabel: string;
  subscriptionId: string;
  day: number;
  mealNum: number;
  menuSlot: number;
}): { ok: true } | { ok: false; error: SelectionValidationError } {
  const sub = getSubscriptionById(data.subscriptionId);
  if (!sub) return { ok: false, error: "subscription_not_found" };
  if (sub.status !== "active") return { ok: false, error: "subscription_not_active" };
  if (data.day < 1 || data.day > 5) return { ok: false, error: "invalid_day" };
  if (data.mealNum < 1 || data.mealNum > sub.mealsPerDay) return { ok: false, error: "invalid_meal_num" };

  const menuItems = getMenuItemsByWeek(data.weekLabel);
  const slotExists = menuItems.some((m) => m.day === data.day && m.slot === data.menuSlot);
  if (!slotExists) return { ok: false, error: "invalid_menu_slot" };

  upsertSelection(data);
  return { ok: true };
}

export function removeSelection(id: string): void {
  deleteSelection(id);
}

export type { MealSelection };
