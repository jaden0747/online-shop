import type {
  Customer,
  CustomerAddress,
  Subscription,
  SubscriptionExtra,
  Pricing,
  MealSkip,
  MealSelection,
  MealDeliveryPlan,
  MenuItem,
  KitchenNote,
  SubscriptionDayNote,
  OrderDayAddress,
  Payment,
  CreditTransaction,
} from "@/lib/data/types";

export type Details = {
  customer: Customer | null;
  addresses: CustomerAddress[];
  subscriptions: Subscription[];
  skipCounts: Record<string, number>;
  totalSpend: number;
  pricing: Pricing[];
  skips: MealSkip[];
  allSelections: MealSelection[];
  mealDeliveryPlans: MealDeliveryPlan[];
  allMenuItems: MenuItem[];
  kitchenNotes: KitchenNote[];
  subscriptionDayNotes: SubscriptionDayNote[];
  dayAddresses: OrderDayAddress[];
  hub: { lat: number; lng: number };
  mealPrices: Record<string, number>;
  payments: Payment[];
  extras: SubscriptionExtra[];
  creditTransactions: CreditTransaction[];
  externalUserId: string | null;
  handoffActive: boolean;
};

export type RouteMap = Map<string, { positions: [number, number][]; distance: number; duration: number }>;
