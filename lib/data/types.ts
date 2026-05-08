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
  status: string; // active | paused | cancelled
  shippingPrice: number;
  subscriptionPrice: number;
  trialDays: number | null; // only when plan = "trial"
  startDate: string; // ISO string
  renewalDate: string; // ISO string
  cancelReason: string | null;
  createdAt: string; // ISO string
}

export interface SubscriptionExtra {
  id: string;
  subscriptionId: string;
  amount: number;
  note: string | null;
  createdAt: string; // ISO string
}

export interface Settings {
  hubLat: number;
  hubLng: number;
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

export interface Order {
  id: string;
  subscriptionId: string;
  weekLabel: string;
  status: string; // pending | prepared | out_for_delivery | delivered
  addressId: string | null;
  createdAt: string; // ISO string
}

export interface OrderItem {
  id: string;
  orderId: string;
  day: number;
  mealSlot: number;
  menuItemId: string | null;
  quantity: number;
  notes: string | null;
}

export interface MealSelection {
  id: string; // `${weekLabel}-${customerId}-${day}-${mealNum}`
  weekLabel: string;
  customerId: string; // customer phone
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
