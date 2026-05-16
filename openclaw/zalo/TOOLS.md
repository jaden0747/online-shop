# TOOLS.md — Oli Healthy Assistant API

## Runtime

Use `curl` through the exec tool. Localhost requests should use the app API, not web search.

Primary base URL:

```bash
BASE_URL="http://127.0.0.1:3099"
```

Fallback base URL:

```bash
BASE_URL="http://127.0.0.1:3000"
```

Assistant endpoints are local-only and do not require bearer-token auth.

For POST requests also include:

```bash
-H "Content-Type: application/json"
```

If port `3099` fails, retry once on `3000`.

## Health Check

```bash
curl -s "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

## Customer Lookup

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/lookup" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "0900000000",
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id"
  }'
```

Possible statuses:

- `matched`
- `not_found`
- `multiple_matches`

## Customer Overview

```bash
curl -s "$BASE_URL/api/assistant/customers/CUSTOMER_ID/overview"
```

Use this for customer-facing account summaries.

Important fields:

- `customer.id`, `customer.name`, `customer.phone`
- `addresses[].id`, `addresses[].label`, `addresses[].address`, `addresses[].isDefault`, `addresses[].hasCoordinates`
- `subscriptions[].id`, `plan`, `goal`, `mealsPerDay`, `status`, `startDate`, `endDate`, `daysRemaining`, `paymentStatus`
- `upcomingSkips[].skipId`, `subscriptionId`, `date`, `replacementDate`, `reason`
- `currentWeekSelections[]`

## Menu Lookup

By date:

```bash
curl -s "$BASE_URL/api/assistant/menu?date=2026-05-18"
```

By week:

```bash
curl -s "$BASE_URL/api/assistant/menu?week=2026-W21"
```

## Meal Selections

Read selections:

```bash
curl -s "$BASE_URL/api/assistant/customers/CUSTOMER_ID/meal-selections?week=2026-W21"
```

Update selections:

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/CUSTOMER_ID/meal-selections" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "confirmedByCustomer": true,
    "subscriptionId": "subscription-id",
    "weekLabel": "2026-W21",
    "day": 1,
    "selections": [
      { "mealNum": 1, "menuSlot": 1 }
    ]
  }'
```

Only write after the customer confirms.

## Skip Day

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/CUSTOMER_ID/skips" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "confirmedByCustomer": true,
    "subscriptionId": "subscription-id",
    "date": "2026-05-18",
    "reason": "customer_request"
  }'
```

Only write after confirming the exact date with the customer.

## Cancel Skip

Use the `skipId` from customer overview. Confirm the exact skipped date before deleting.

```bash
curl -s -X DELETE "$BASE_URL/api/assistant/customers/CUSTOMER_ID/skips/SKIP_ID" \
  -H "x-source: zalo-bot" \
  -H "x-external-user-id: zalo-user-id"
```

Expected success:

```json
{ "status": "ok" }
```

## Temporary Day Address

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/CUSTOMER_ID/day-address" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "confirmedByCustomer": true,
    "subscriptionId": "subscription-id",
    "date": "2026-05-18",
    "addressId": "address-id"
  }'
```

Only saved customer addresses are allowed. New addresses require manager review.

## New Customer Lead

Find pending leads first when you know the phone or Zalo sender id:

```bash
curl -s "$BASE_URL/api/assistant/leads?phone=0900000000"
```

```bash
curl -s "$BASE_URL/api/assistant/leads?externalUserId=zalo-user-id"
```

Create a lead:

```bash
curl -s -X POST "$BASE_URL/api/assistant/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "name": "Customer Name",
    "phone": "0900000000",
    "address": "Customer address",
    "goal": "cutting",
    "mealsPerDay": 2,
    "planInterest": "weekly",
    "note": "Customer prefers lunch delivery"
  }'
```

Creating a lead does not create a paid subscription.

## Update Pending Lead

Use this only for leads with `status: "pending"`. The API accepts any subset of updatable fields.

```bash
curl -s -X PATCH "$BASE_URL/api/assistant/leads/LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "name": "Updated Customer Name",
    "phone": "0900000000",
    "address": "Updated address",
    "goal": "cutting",
    "mealsPerDay": 2,
    "planInterest": "weekly",
    "note": "Updated customer note"
  }'
```

If the API returns `409`, the lead is already converted or rejected. Escalate to Phong.

## Renewal Request

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/CUSTOMER_ID/renewal-requests" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "subscriptionId": "subscription-id",
    "samePackage": true,
    "note": "Customer wants to renew the same package"
  }'
```

## Manager Review Request

Use this for sensitive changes that the bot should not apply directly.

Allowed `type` values:

- `new_address`
- `cancellation_request`
- `refund_request`
- `payment_proof`
- `phone_change`
- `price_change`
- `renewal_request`

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/CUSTOMER_ID/pending-reviews" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "zalo-bot",
    "externalUserId": "zalo-user-id",
    "type": "new_address",
    "subscriptionId": "subscription-id",
    "payload": {
      "requestedAddress": "Customer provided address",
      "effectiveDate": "2026-05-18",
      "customerNote": "Customer wants this as the new default address"
    }
  }'
```

`subscriptionId` is optional, but include it when the request clearly relates to a subscription. Payload shape is flexible; include only facts the customer gave or that came from the API.

## Error Handling

- `400`: missing or invalid fields. Ask a clarifying question if needed.
- `403`: resource does not belong to this customer. Escalate.
- `404`: customer or resource not found.
- `409`: lead cannot be updated because it is no longer pending.
- `422`: validation failed, such as non-delivery day or outside subscription.
- `207`: partial success for meal selection batch. Explain only the customer-relevant part.

Never show raw JSON errors to customers. Summarize politely and ask a clarifying question or escalate.
