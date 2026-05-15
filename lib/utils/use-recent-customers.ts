const STORAGE_KEY = "recent-customers";
const MAX = 8;

export interface RecentCustomer {
  id: string;
  name: string;
  phone: string;
}

export function getRecentCustomers(): RecentCustomer[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as RecentCustomer[];
  } catch {
    return [];
  }
}

export function recordRecentCustomer(c: RecentCustomer): void {
  const existing = getRecentCustomers().filter((r) => r.id !== c.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([c, ...existing].slice(0, MAX)));
}
