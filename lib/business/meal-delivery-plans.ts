import {
  deleteMealDeliveryPlanByDate,
  getAllMealDeliveryPlans,
  getAllSkips,
  getSubscriptionById,
  updateSubscription,
  upsertMealDeliveryPlan,
} from "@/lib/data/subscriptions";
import {
  mealsForDate,
  plannedMealsBeforeDate,
  projectedEndDateForSubscription,
  totalMealEntitlement,
} from "@/lib/utils/schedule";
import type { MealDeliveryPlan } from "@/lib/data/types";

export type MealPlanUpdateResult =
  | { ok: true; plan: MealDeliveryPlan | null; endDate: string; remainingBeforeDate: number }
  | { ok: false; error: "subscription_not_found" | "invalid_date" | "invalid_meal_count" | "exceeds_remaining_meals" };

export function recalculateSubscriptionEndDate(subscriptionId: string): string | null {
  const sub = getSubscriptionById(subscriptionId);
  if (!sub) return null;
  const plans = getAllMealDeliveryPlans().filter((p) => p.subscriptionId === subscriptionId);
  const skips = getAllSkips().filter((sk) => sk.subscriptionId === subscriptionId);
  const projectedEnd = projectedEndDateForSubscription(sub, plans, skips);
  const iso = projectedEnd.toISOString();
  updateSubscription(subscriptionId, { endDate: iso });
  return iso;
}

export function updateMealPlanForDate(data: {
  subscriptionId: string;
  date: string;
  plannedMeals: number;
  reason?: string | null;
}): MealPlanUpdateResult {
  const sub = getSubscriptionById(data.subscriptionId);
  if (!sub) return { ok: false, error: "subscription_not_found" };

  const date = new Date(data.date.length === 10 ? data.date + "T00:00:00" : data.date);
  if (isNaN(date.getTime())) return { ok: false, error: "invalid_date" };
  date.setHours(0, 0, 0, 0);

  const plannedMeals = Math.floor(data.plannedMeals);
  if (!Number.isInteger(plannedMeals) || plannedMeals < 0) {
    return { ok: false, error: "invalid_meal_count" };
  }

  const plans = getAllMealDeliveryPlans().filter((p) => p.subscriptionId === data.subscriptionId);
  const skips = getAllSkips().filter((sk) => sk.subscriptionId === data.subscriptionId);
  const consumedBeforeDate = plannedMealsBeforeDate(sub, date, plans, skips);
  const remainingBeforeDate = Math.max(0, totalMealEntitlement(sub) - consumedBeforeDate);

  if (plannedMeals > remainingBeforeDate) {
    return { ok: false, error: "exceeds_remaining_meals" };
  }

  const defaultMeals = mealsForDate(sub, date);
  let plan: MealDeliveryPlan | null = null;
  if (plannedMeals === defaultMeals) {
    plan = deleteMealDeliveryPlanByDate(data.subscriptionId, data.date);
  } else {
    plan = upsertMealDeliveryPlan({
      subscriptionId: data.subscriptionId,
      date: data.date,
      plannedMeals,
      reason: data.reason ?? null,
    });
  }

  const endDate = recalculateSubscriptionEndDate(data.subscriptionId) ?? sub.endDate;
  return { ok: true, plan, endDate, remainingBeforeDate };
}
