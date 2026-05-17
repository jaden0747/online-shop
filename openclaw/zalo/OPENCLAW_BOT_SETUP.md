# OpenClaw Zalo Bot Setup

This document describes how to run the Oli Healthy Zalo assistant with the app-side assistant API.

## Architecture

```text
Zalo customer
  -> OpenClaw Zalo Personal channel
  -> OpenClaw agent: zalo-business
  -> Assistant API: /api/assistant/*
  -> Oli Healthy app data
```

The bot must call the assistant API. It should not call old unauthenticated app endpoints and should not write directly to Excel files.

## Required Services

### 1. Oli Healthy App

Run either:

- Electron app, which should expose the server on `http://127.0.0.1:3099`
- Dev server:

```bash
npm run dev
```

Dev server usually runs on `http://127.0.0.1:3000`.

### 2. OpenClaw Gateway

Start OpenClaw:

```bash
openclaw daemon start
```

Restart after changing bot files:

```bash
openclaw daemon restart
```

## OpenClaw Runtime Settings

The Zalo channel is routed to the dedicated `zalo-business` agent.

Expected config:

```text
channel zalouser -> agent zalo-business
agent workspace -> ~/.openclaw/workspace-zalo
```

The `zalo-business` workspace should include:

- `AGENTS.md`: bot rules and conversation flows
- `TOOLS.md`: assistant API endpoint reference
- `SOUL.md`: tone and persona
- `USER.md`: owner/escalation context
- `IDENTITY.md`: bot identity

## Zalo Login

Check channel status:

```bash
openclaw channels status
```

If Zalo Personal shows `SETUP`, log in:

```bash
openclaw channels login --channel zalouser --account default --verbose
```

Scan the QR code with Zalo if prompted.

## Pairing First-Time Senders

The config currently uses pairing for Zalo users. New senders may need approval before the bot responds.

Check logs:

```bash
openclaw logs --follow
```

Approve a pairing code:

```bash
openclaw pairing approve zalouser CODE
```

## How To Test

### Check App API

```bash
BASE_URL="http://127.0.0.1:3099"

curl -s "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

If Electron is not running, use:

```bash
BASE_URL="http://127.0.0.1:3000"
```

### Test Customer Lookup

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/lookup" \
  -H "Content-Type: application/json" \
  -d '{"phone":"CUSTOMER_PHONE","source":"zalo-bot","externalUserId":"manual-test"}'
```

### Test OpenClaw Agent Locally

Send a direct agent turn:

```bash
openclaw agent --agent zalo-business --message "Khách hỏi menu hôm nay, em nên làm gì?"
```

If the command syntax differs in this OpenClaw version, run:

```bash
openclaw agent --help
```

### Watch Logs

```bash
openclaw logs --follow
```

## What The Bot Can Do

Current allowed direct actions:

- answer shipping fee questions
- answer questions about how the shop operates

Everything else is out of scope for the current phase.

Detailed requirements for the 2 tasks should be filled into:

- `openclaw/zalo/AGENTS.md`
- `openclaw/zalo/TOOLS.md`

## Operating Checklist

Before going live:

1. App is running.
2. `~/.openclaw/workspace-zalo/AGENTS.md` and `TOOLS.md` use `/api/assistant/*`.
3. Zalo channel status is `OK`.
4. A test customer lookup works.
5. A test menu lookup works.
6. OpenClaw logs show no repeated API errors.
7. `/assistant` page in the app shows API logs.

## Useful Commands

```bash
openclaw status
openclaw channels status
openclaw channels login --channel zalouser --account default --verbose
openclaw logs --follow
openclaw daemon restart
openclaw config file
openclaw config get agents.list
```
