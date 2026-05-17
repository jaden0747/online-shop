export interface Customer {
  id: string; // = phone (natural key)
  name: string;
  phone: string;
  address: string;
  zone: string;
  notes: string | null;
  createdAt: string; // ISO string
}

export interface CustomerAddress {
  id: string;
  customerId: string; // = customer phone
  label: string;
  address: string;
  zone: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
  createdAt: string; // ISO string
}

export interface Subscription {
  id: string;
  customerId: string; // = customer phone
  plan: string; // trial | weekly | monthly
  goal: string; // cutting | maintenance | bulking
  mealsPerDay: number;
  status: string; // active | cancelled
  shippingPrice: number;
  subscriptionPrice: number;
  discount: number;
  trialDays: number | null; // only when plan = "trial"
  startDate: string; // ISO string
  endDate: string; // ISO string - last delivery day (inclusive), extended by skips
  endDateNoSkip: string; // ISO string - base end date without skip extensions
  cancelReason: string | null;
  cancelledAt: string | null;
  addressId: string | null; // default delivery address for this sub; null = use customer default
  createdAt: string; // ISO string
}

export interface SubscriptionExtra {
  id: string;
  subscriptionId: string;
  amount: number;
  note: string | null;
  startDate: string | null; // ISO — start of recognition period (null = recognize on createdAt)
  endDate: string | null;   // ISO — end of period (null = same as startDate, single day)
  createdAt: string; // ISO string
}

export interface Settings {
  hubLat: number;
  hubLng: number;
  mealPriceCutting: number;
  mealPriceMaintenance: number;
  mealPriceBulking: number;
  mealPriceKeto: number;
  // Formula pricing
  basePricePerMeal: number; // base cost per meal before goal multiplier
  goalMultiplierCutting: number; // e.g. 1.0
  goalMultiplierMaintenance: number;
  goalMultiplierBulking: number;
  goalMultiplierKeto: number;
  // Shipping fee zones (distance-based)
  shippingFeeZone1MaxKm: number; // upper bound of zone 1 in km
  shippingFeeZone1: number;       // flat fee for zone 1
  shippingFeeZone2MaxKm: number;
  shippingFeeZone2: number;
  shippingFeeZone3MaxKm: number;
  shippingFeeZone3: number;
  shippingFeeZone4PerKm: number;  // per-km rate for distances beyond zone 3
}

export interface MealSkip {
  id: string;
  subscriptionId: string;
  originalDay: string; // ISO string
  replacementDay: string | null; // ISO string
  reason: string | null;
  createdAt: string; // ISO string
}

export interface MenuItem {
  id: string; // = `${weekLabel}-${day}-${slot}`
  weekLabel: string;
  day: number;
  slot: number;
  name: string;
  description: string | null;
  calories: number | null;
  protein: number | null;
  goals: string; // comma-separated
}

export interface Pricing {
  id: string; // = `${plan}-${goal}-${mealsPerDay}`
  plan: string;
  goal: string;
  mealsPerDay: number;
  totalPrice: number;
}

export interface MealSelection {
  id: string; // `${weekLabel}-${subscriptionId}-${day}-${mealNum}`
  weekLabel: string;
  subscriptionId: string;
  day: number; // 1-5
  mealNum: number; // 1, 2 (which meal of the day if mealsPerDay > 1)
  menuSlot: number; // 1 or 2 (Option A or Option B)
}

export interface KitchenNote {
  id: string; // `${weekLabel}-${customerId}-${day}`
  weekLabel: string;
  customerId: string; // customer phone
  day: number; // 1-5
  note: string;
}

export interface OrderDayAddress {
  id: string; // `${subscriptionId}-${weekLabel}-${day}`
  subscriptionId: string;
  weekLabel: string;
  day: number;
  addressId: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  type: "payment" | "refund";
  amount: number; // always positive; sign comes from `type`
  paidAt: string; // ISO string
  method: "cash" | "transfer" | "momo" | "other" | "credit";
  note: string | null;
  createdAt: string; // ISO string
}

export interface CostCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string; // ISO string
}

export interface CostItem {
  id: string;
  weekLabel: string; // e.g. "2025-W21"
  categoryId: string;
  amount: number;
  note: string | null;
  createdAt: string; // ISO string
}

export interface WeeklyOps {
  id: string; // = weekLabel
  weekLabel: string;
  mealsPrepared: number;
  mealsDelivered: number;
  wastedMeals: number;
  note: string | null;
  updatedAt: string; // ISO string
}

export interface CreditTransaction {
  id: string;
  customerId: string; // = customer phone
  type: "refund_credit" | "manual_topup" | "credit_used" | "adjustment";
  amount: number; // always positive — sign determined by type
  subscriptionId: string | null; // linked sub when credit originated from/applied to a sub
  note: string;
  createdAt: string; // ISO string
}

export interface CustomerLead {
  id: string;
  source: string; // e.g. "zalo-bot", "manual"
  externalUserId: string | null;
  name: string;
  phone: string;
  address: string | null;
  geocodedLat: number | null;
  geocodedLng: number | null;
  goal: string | null;
  mealsPerDay: number | null;
  planInterest: string | null;
  note: string | null;
  status: "pending" | "converted" | "rejected";
  createdAt: string; // ISO string
}

export interface PendingReview {
  id: string;
  type:
    | "new_address"
    | "cancellation_request"
    | "refund_request"
    | "renewal_request"
    | "payment_proof"
    | "phone_change"
    | "price_change";
  source: string; // e.g. "zalo-bot"
  externalUserId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  payload: Record<string, unknown>; // the proposed change
  status: "pending" | "approved" | "rejected";
  managerNote: string | null;
  createdAt: string; // ISO string
}

export interface ConversationControl {
  id: string; // `${channel}:${externalUserId}`
  channel: string; // e.g. "zalouser"
  externalUserId: string;
  mode: "bot" | "human_active";
  source: "human_outbound_zalo" | "manager_app_action" | "bot_escalation" | null;
  lastHumanMessageAt: string | null; // ISO string
  lockExpiresAt: string | null; // ISO string
  updatedAt: string; // ISO string
}

export interface AssistantActionLog {
  id: string;
  source: string; // e.g. "zalo-bot", "admin-test"
  externalUserId: string | null;
  customerId: string | null;
  action: string; // e.g. "skip_day", "update_selection", "customer_lookup"
  request: Record<string, unknown>;
  result: Record<string, unknown>;
  createdAt: string; // ISO string
}
