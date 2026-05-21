export interface WeekSummary {
  weekLabel: string;
  dateRange: string;
  totalCost: number;
  mealsDelivered: number;
  costPerMeal: number | null;
  revenue: number;
  profit: number;
}
