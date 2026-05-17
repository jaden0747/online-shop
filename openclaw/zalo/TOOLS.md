# TOOLS.md — Oli Healthy Zalo Assistant

## Runtime

Use `curl` through the exec tool for all local API calls.

Primary base URL:

```bash
BASE_URL="http://127.0.0.1:3099"
```

Fallback base URL:

```bash
BASE_URL="http://127.0.0.1:3000"
```

Assistant endpoints are local-only and do not require bearer-token auth.

If port `3099` fails, retry once on `3000`.

## Approved Endpoints For Current Phase

Only the endpoints listed below are approved. Do not call any other app endpoint.

---

## 1. Customer Lookup

Use this to determine if a Zalo sender is a known customer.

### By externalUserId (try first)

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/lookup" \
  -H "Content-Type: application/json" \
  -H "x-source: zalo-bot" \
  -d "{\"externalUserId\": \"$ZALO_USER_ID\", \"source\": \"zalo-bot\"}"
```

Replace `$ZALO_USER_ID` with the sender's Zalo user ID.

### By phone (when customer provides it)

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/lookup" \
  -H "Content-Type: application/json" \
  -H "x-source: zalo-bot" \
  -d "{\"phone\": \"$PHONE\", \"externalUserId\": \"$ZALO_USER_ID\", \"source\": \"zalo-bot\"}"
```

### Response shapes

| `status` | Meaning |
|---|---|
| `matched` | Customer found. `customer.id` is the customer ID. `externalUserId` is their Zalo ID (null if no link). |
| `lead_only` | A lead exists for this sender but no customer record yet. |
| `not_found` | No customer or lead found. Treat as new contact. |
| `multiple_matches` | Phone matched multiple records. Escalate to human. |

---

## 2. Customer Overview (addresses + subscriptions)

Use this after a successful `matched` lookup to get the customer's saved addresses.

```bash
curl -s "$BASE_URL/api/assistant/customers/$CUSTOMER_ID/overview" \
  -H "x-source: zalo-bot" \
  -H "x-external-user-id: $ZALO_USER_ID"
```

Key fields from the response:

- `addresses[]` — list of saved addresses. Each has: `id`, `label`, `address`, `zone`, `isDefault`, `hasCoordinates`
- `subscriptions[]` — active/upcoming subscriptions

Only use addresses that have `hasCoordinates: true` for shipping fee estimation.
If an address has `hasCoordinates: false`, it has no coordinates and the fee cannot be estimated — tell the customer the shop will confirm directly.

---

## 3. Shipping Fee Estimate

### For an existing customer's saved address

```bash
curl -s "$BASE_URL/api/assistant/shipping-fee?customerId=$CUSTOMER_ID&addressId=$ADDRESS_ID" \
  -H "x-source: zalo-bot" \
  -H "x-external-user-id: $ZALO_USER_ID"
```

### For a new customer (coordinates from geocoding)

```bash
curl -s "$BASE_URL/api/assistant/shipping-fee?lat=$LAT&lng=$LNG" \
  -H "x-source: zalo-bot" \
  -H "x-external-user-id: $ZALO_USER_ID"
```

### Response

```json
{
  "fee": 25000,
  "distanceKm": 4.2,
  "zones": {
    "zone1": "0–3km → 15,000đ",
    "zone2": "3–6km → 25,000đ",
    "zone3": "6–10km → 35,000đ",
    "zone4": ">10km → 5,000đ/km"
  }
}
```

Always present `fee` to the customer formatted in Vietnamese (e.g. "25.000đ"). Never show raw JSON.

### Error cases

- `422` with `"Address has no coordinates"` → tell customer shop will confirm fee directly, escalate to human
- Any other error or connection failure → tell customer shop will confirm fee directly, escalate to human

---

## 4. Conversation Control (Human Handoff)

Use this to check handoff state before replying, and to set the lock when escalating.

### Read current state (call at the start of every turn)

```bash
curl -s "$BASE_URL/api/assistant/conversation-control?channel=zalouser&externalUserId=$ZALO_USER_ID" \
  -H "x-source: zalo-bot"
```

Response:

```json
{
  "mode": "bot",
  "lockExpiresAt": null
}
```

If `mode` is `"human_active"` and the lock has not expired: **do not reply to the customer at all. Stop immediately.**

### Set lock after escalating to human

Call this right after sending the owner Telegram message:

```bash
curl -s -X POST "$BASE_URL/api/assistant/conversation-control" \
  -H "Content-Type: application/json" \
  -H "x-source: zalo-bot" \
  -H "x-external-user-id: $ZALO_USER_ID" \
  -d "{\"channel\": \"zalouser\", \"externalUserId\": \"$ZALO_USER_ID\", \"mode\": \"human_active\", \"source\": \"bot_escalation\", \"ttlMinutes\": 30}"
```

This sets a 30-minute silence window so the bot does not reply while the manager begins handling the thread.

### Clear lock manually (if needed)

```bash
curl -s -X DELETE "$BASE_URL/api/assistant/conversation-control?channel=zalouser&externalUserId=$ZALO_USER_ID" \
  -H "x-source: zalo-bot"
```

---

## 6. Health Check

```bash
curl -s "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

Use only to verify app is reachable. Do not use menu data for any customer reply in this phase.

---

## 7. Human Escalation Via Telegram

When you must escalate to the owner, send a Telegram message with the local OpenClaw CLI.

Owner target:

```bash
OWNER_TELEGRAM_TARGET="8317205661"
```

Command:

```bash
openclaw message send \
  --channel telegram \
  --target "$OWNER_TELEGRAM_TARGET" \
  --message "$ESCALATION_MESSAGE"
```

Build `$ESCALATION_MESSAGE` as a short operational summary in Vietnamese with:

1. reason for escalation
2. customer channel (`zalo`)
3. customer external user id
4. customer message
5. any lookup/API result that matters

Example:

```bash
ESCALATION_MESSAGE="Can shop ho tro khach Zalo.
Ly do: ngoai pham vi bot / khong du tu tin de tra loi.
Kenh: zalo
External user id: $ZALO_USER_ID
Tin nhan khach: $CUSTOMER_MESSAGE
Ghi chu: can shop theo doi truc tiep."
```

After sending the owner escalation, reply to the customer with the standard escalation line. Do not include internal debugging details in the customer-facing message.

---

## Geocoding (for new customers — web tool)

When a new customer provides their address and you need to geocode it:

1. Use the web tool (web_fetch or web_search) to search for the address.
2. Get the GPS coordinates (latitude, longitude).
3. Build a Google Maps link: `https://www.google.com/maps?q={lat},{lng}`
4. Send that link to the customer and ask them to confirm the location is correct.
5. Only after customer confirmation, call the shipping fee estimate endpoint with those coordinates.

Do NOT send coordinates to the server without customer confirmation first.

---

## Disabled For Current Phase

These assistant API areas exist in the app, but the bot must not use them in this phase:

- `POST /api/assistant/leads` — lead creation
- `PATCH /api/assistant/leads/:id` — lead update
- `GET /api/assistant/customers/:id/meal-selections`
- `POST /api/assistant/customers/:id/meal-selections`
- `POST /api/assistant/customers/:id/skips`
- `DELETE /api/assistant/customers/:id/skips/:skipId`
- `POST /api/assistant/customers/:id/day-address`
- `POST /api/assistant/customers/:id/renewal-requests`
- `POST /api/assistant/customers/:id/pending-reviews`

---

## Error Handling

- Never show raw JSON or error messages to the customer.
- On any unexpected error: say "Dạ bên em sẽ xác nhận lại và phản hồi anh/chị sớm nhất ạ." and escalate to owner via Telegram.
- If the local app is unreachable on both ports: escalate to human, do not guess.
