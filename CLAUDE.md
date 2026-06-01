@AGENTS.md

# Codebase Overview

## What this is
**Shop Organizer** ("Oli Healthy") — an Electron desktop app wrapping a Next.js server that manages a Vietnamese meal-delivery subscription business. Mon–Fri deliveries only. All amounts in VND.

## Tech stack
- **Next.js 16.2.4** + **React 19** + **TypeScript** — `app/` router, all pages use `export const dynamic = "force-dynamic"` (no static generation)
- **Tailwind v4** + **shadcn/ui** (`components/ui/`) + **@base-ui/react** (Popover, etc.)
- **Electron 42** — `electron/main.js` + `electron/preload.js`; IPC for data dir, auto-update via `electron-updater`
- **Recharts** for charts, **Leaflet / react-leaflet** for maps
- **Vitest** for tests (`__tests__/`), **xlsx** as the database (see below)

## Data layer — Excel files as DB
All data lives in `.xlsx` files in `data/` (configurable via `DATA_DIR` env var). No SQL.

Key functions in `lib/data/excel.ts`:
- `readRows<T>(file, sheet)` — read all rows from a named sheet, mtime-cached
- `writeRows<T>(file, sheet, rows)` — overwrite a sheet, preserves other sheets
- `getDataDir()` — returns `data/test/` when `.testing-mode` flag file exists, otherwise `data/`

Each domain has its own file+sheet: `customers.xlsx/Customers`, `subscriptions.xlsx/Subscriptions`, etc.

## Domain types (`lib/data/types.ts`)
Key interfaces:
- `Customer` — id = phone (natural key)
- `Subscription` — plan: trial|weekly|monthly; goal: cutting|maintenance|bulking|keto; `endDate` = last delivery day (inclusive, extended by skips); `endDateNoSkip` = base end date; `weeklyScheduleJson` = per-day meal distribution JSON
- `MealDeliveryPlan` — explicit override for plannedMeals on a specific date
- `Payment` — type: payment|refund; method: cash|transfer|momo|other|credit
- `CreditTransaction` — type: refund_credit|manual_topup|credit_used|adjustment
- `MealSkip` — originalDay + optional replacementDay; extends endDate
- `MenuItem` — weekLabel (e.g. "2025-W21") + day (1–5) + slot (1 or 2)
- `MealSelection` — which slot a customer picked for a given week/day/mealNum
- `Settings` — hub GPS coords, per-goal meal prices, formula pricing, 4-zone shipping fees

## Constants (`lib/constants.ts`)
```ts
PLANS = ["trial", "weekly", "monthly"]
GOALS = ["cutting", "maintenance", "bulking", "keto"]
PAYMENT_METHODS = ["cash", "transfer", "momo", "other"]
```

## Business logic
All in `lib/business/` and `lib/utils/`:

**Schedule** (`lib/utils/schedule.ts`) — canonical source for "meals on day X":
- `mealsForDate(sub, date)` — respects `weeklyScheduleJson`; 0 on weekends
- `plannedMealsForDate(sub, date, plans, skips)` — checks explicit MealDeliveryPlan first, then skips, then weeklySchedule
- `totalMealEntitlement(sub)` — uses `totalMeals` field if set, else counts scheduled meals from startDate→endDateNoSkip

**Revenue** (`lib/utils/revenue.ts`):
- Accrual-based: `earnedRevenueAsOf(sub, skips, extras, asOf)` = pricePerMeal × mealsDeliveredAsOf
- `pricePerMeal(sub)` = effectiveTotal / totalMealEntitlement (effectiveTotal = subscriptionPrice + shippingPrice − discount)
- `earnedRevenueInRange(sub, skips, extras, from, to)` — for weekly bucketing

**Subscription** (`lib/utils/subscription.ts`):
- `isSubscriptionLive(status, startDate, endDate, asOf?)` — false if cancelled
- `suggestedRefund(sub, skips, payments, asOf, extras)` — meal-based pro-rata refund
- `planTotalMeals(plan)`: trial=3, weekly=5, monthly=20

## Pages / routes
| Route | Purpose |
|---|---|
| `/` | Dashboard — KPIs, expiring subs, recent customers, 6 charts |
| `/customers` | Customer list + add/import |
| `/subscriptions` | Subscription list with filters; inline edit row |
| `/menu` | Weekly menu grid — meal slots per day, customer selections |
| `/costs` | Cost items by week + category breakdown |
| `/reports` | Revenue/cost charts across weeks |
| `/shipping` | Today's delivery list with addresses |
| `/route` | Leaflet map with delivery route clustering |
| `/coverage` | Coverage area map |
| `/addresses` | Address management |
| `/settings` | Hub location, meal prices, shipping zones, cost categories |
| `/assistant` | Bot handoff UI — convert leads, approve/reject pending reviews |
| `/testing` | Only visible when testing mode is on |

## Actions (`app/actions/`)
Next.js Server Actions — one file per domain. They read/write Excel files via `lib/data/` functions and call `revalidatePath("/")` (or specific paths) to refresh data.

## Components
- `components/customer-overlay/` — slide-out panel with full customer detail: sub info, payments, credits, skips, meal selections, address
- `components/ui/` — shadcn primitives
- `components/global-search.tsx` — ⌘K customer search
- `components/sidebar-client.tsx` — horizontal top nav bar

## Testing mode
Toggle via `data/.testing-mode` flag file. When present, all reads/writes go to `data/test/`. The `TestingBanner` shows a yellow banner. Toggled from `/settings`.

## Electron packaging
- `npm run electron:dev` — run in dev (starts Next.js + Electron together)
- `npm run electron:build` — build macOS DMG
- `npm run release` — tag + build + publish to GitHub releases
- Data dir in production: `~/Library/Application Support/shop-organizer/data`

## Week labels
Format: `"YYYY-WNN"` (e.g. `"2025-W21"`). Utilities in `lib/utils/week.ts`: `currentWeekLabel()`, `weekLabelForDate(date)`, `currentWeekMonday()`.

## Key invariants
- Customer `id` === `phone` — they are interchangeable as foreign keys
- `endDate` is always the last delivery day inclusive (may be extended past `endDateNoSkip` by skips)
- Revenue recognition is accrual — never recognize cash received, always recognize by meals delivered
- `cancelledAt` is the first **unserved** day (exclusive upper bound for delivered meals)
- All weekday numbering: 1=Mon … 5=Fri (JavaScript `getDay()` returns 1–5 for Mon–Fri)

---

## Keeping this file updated
Run `/update-claude-md` after any change to domain types, business rules, routes, or data architecture.

