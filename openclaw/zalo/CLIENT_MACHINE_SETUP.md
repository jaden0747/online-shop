# Client Machine Setup For Oli Healthy Zalo Bot

This guide explains how to set up the Oli Healthy Zalo bot on another machine.

Use this when installing the app and OpenClaw on a client/production machine.

## Goal

Set up this full stack:

```text
Oli Healthy app
  -> local assistant API
  -> OpenClaw daemon
  -> Zalo Personal channel
  -> zalo-business agent
  -> customer replies on Zalo
```

## Prerequisites

On the client machine, you need:

- macOS machine that will stay online while the bot should reply.
- Oli Healthy app installed or this webapp repo available.
- Node.js installed if running dev mode.
- OpenClaw installed.
- OpenRouter/model provider configured in OpenClaw.
- Zalo account available for bot use.
- Bot workspace files from this repo.

Recommended production setup:

- Run the packaged Electron app.
- Let Electron expose the app server on `http://127.0.0.1:3099`.
- Run OpenClaw as a LaunchAgent.
- Login Zalo Personal through OpenClaw.

## Files To Bring To The Client Machine

From this repo, bring:

```text
openclaw/zalo/AGENTS.md
openclaw/zalo/TOOLS.md
openclaw/zalo/OPENCLAW_BOT_SETUP.md
openclaw/zalo/OPENCLAW_USER_MANUAL.md
openclaw/zalo/CLIENT_MACHINE_SETUP.md
```

If installing from source, bring the whole webapp repo.

If installing packaged app, bring:

- app installer/build
- bot files above
- data files if this is a migration

## Step 1: Install Or Start The Oli Healthy App

### Option A: Packaged Electron App

Install and open the Oli Healthy Electron app.

Expected API base URL:

```text
http://127.0.0.1:3099
```

### Option B: Dev Mode

From the webapp repo:

```bash
cd /path/to/webapp
npm install
npm run dev
```

Expected API base URL:

```text
http://127.0.0.1:3000
```

## Step 2: Check The Local Assistant API

The assistant API is local-only and does not require bearer-token auth.

Test:

```bash
BASE_URL="http://127.0.0.1:3099"

curl -s -i "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

If using dev mode:

```bash
BASE_URL="http://127.0.0.1:3000"
```

Expected:

```text
HTTP/1.1 200 OK
```

and a JSON menu response.

If you see:

- connection error: app is not running or wrong port.

## Step 3: Install OpenClaw

Install OpenClaw according to the official installation method you use.

Verify:

```bash
openclaw --version
openclaw status
```

If this is a new machine, run initial setup:

```bash
openclaw configure
```

or:

```bash
openclaw onboard
```

Use your preferred model provider. The current setup uses OpenRouter.

## Step 4: Start OpenClaw Daemon

```bash
openclaw daemon start
```

Check:

```bash
openclaw status
```

Expected:

```text
Gateway reachable
```

If not:

```bash
openclaw daemon restart
openclaw status --deep
```

## Step 5: Create Or Configure The Zalo Agent

The bot should use a dedicated agent:

```text
zalo-business
```

Check current agents:

```bash
openclaw config get agents.list
```

If `zalo-business` does not exist, create/update the OpenClaw config so it includes an agent like:

```json
{
  "id": "zalo-business",
  "name": "zalo-business",
  "workspace": "/Users/YOUR_USER/.openclaw/workspace-zalo",
  "agentDir": "/Users/YOUR_USER/.openclaw/agents/zalo-business/agent"
}
```

The exact config command may vary by OpenClaw version. You can either use:

```bash
openclaw configure
```

or edit:

```text
~/.openclaw/openclaw.json
```

Then restart:

```bash
openclaw daemon restart
```

## Step 6: Install Bot Workspace Files

Create the workspace:

```bash
mkdir -p ~/.openclaw/workspace-zalo
```

Copy files:

```bash
cp openclaw/zalo/AGENTS.md ~/.openclaw/workspace-zalo/AGENTS.md
cp openclaw/zalo/TOOLS.md ~/.openclaw/workspace-zalo/TOOLS.md
cp openclaw/zalo/OPENCLAW_BOT_SETUP.md ~/.openclaw/workspace-zalo/OPENCLAW_BOT_SETUP.md
cp openclaw/zalo/OPENCLAW_USER_MANUAL.md ~/.openclaw/workspace-zalo/OPENCLAW_USER_MANUAL.md
cp openclaw/zalo/CLIENT_MACHINE_SETUP.md ~/.openclaw/workspace-zalo/CLIENT_MACHINE_SETUP.md
```

Optional but recommended if the files do not already exist:

```bash
touch ~/.openclaw/workspace-zalo/IDENTITY.md
touch ~/.openclaw/workspace-zalo/SOUL.md
touch ~/.openclaw/workspace-zalo/USER.md
```

Suggested `IDENTITY.md`:

```text
# IDENTITY

Name: Oli
Role: Zalo customer assistant for Oli Healthy
```

Suggested `SOUL.md`:

```text
# SOUL

Be warm, concise, polite, and service-focused. Use Vietnamese when customers use Vietnamese. Do not give medical advice. Escalate complaints, refunds, cancellations, and payment proof to Phong.
```

Suggested `USER.md`:

```text
# USER

Owner: Phong
Business: Oli Healthy
Escalate manager-review requests to Phong through the app's Assistant page.
```

Restart:

```bash
openclaw daemon restart
```

## Step 7: Route Zalo To The Zalo Agent

Check existing bindings:

```bash
openclaw config get bindings
```

Expected route:

```json
{
  "type": "route",
  "agentId": "zalo-business",
  "match": {
    "channel": "zalouser"
  }
}
```

If missing, add it through OpenClaw config tooling or edit `~/.openclaw/openclaw.json`.

After editing:

```bash
openclaw daemon restart
```

## Step 8: Enable And Login Zalo Personal

Check channels:

```bash
openclaw channels status
```

If Zalo Personal is not configured:

```bash
openclaw channels login --channel zalouser --account default --verbose
```

Scan the QR code with the Zalo account that should act as the bot.

Check again:

```bash
openclaw channels status
```

Expected:

```text
Zalo Personal | ON | OK
```

## Step 9: Pair First-Time Customers

If pairing is enabled, new senders may need approval.

Watch logs:

```bash
openclaw logs --follow
```

Approve:

```bash
openclaw pairing approve zalouser CODE
```

## Step 10: Test The API From The Client Machine

Menu:

```bash
BASE_URL="http://127.0.0.1:3099"

curl -s "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

Customer lookup:

```bash
curl -s -X POST "$BASE_URL/api/assistant/customers/lookup" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "CUSTOMER_PHONE",
    "source": "zalo-bot",
    "externalUserId": "manual-client-test"
  }'
```

## Step 11: Test OpenClaw Agent

```bash
openclaw agent --agent zalo-business \
  --message "Sanity check only. What endpoint should you use to look up today's menu? Reply in one short line."
```

Expected answer should mention:

```text
/api/assistant/menu
```

If it mentions old endpoints like `/api/menu`, the workspace files were not copied or OpenClaw was not restarted.

## Step 12: Test Real Zalo Message

From another Zalo account, send:

```text
Menu hôm nay có gì?
```

Watch:

```bash
openclaw logs --follow
```

Then test account flow:

```text
Gói của chị còn mấy ngày?
```

The bot should ask for phone number if it does not know the customer yet.

## Daily Operation

Start the app.

Check OpenClaw:

```bash
openclaw status
```

Check Zalo:

```bash
openclaw channels status
```

Watch logs if debugging:

```bash
openclaw logs --follow
```

Review manager page:

```text
/assistant
```

## Updating Bot Behavior On Client Machine

Edit source files in the repo:

```text
openclaw/zalo/AGENTS.md
openclaw/zalo/TOOLS.md
```

Copy to live workspace:

```bash
cp openclaw/zalo/AGENTS.md ~/.openclaw/workspace-zalo/AGENTS.md
cp openclaw/zalo/TOOLS.md ~/.openclaw/workspace-zalo/TOOLS.md
openclaw daemon restart
```

Test:

```bash
openclaw agent --agent zalo-business --message "What API do you use for customer lookup?"
```

## Common Problems

### Zalo Personal Shows SETUP

Run:

```bash
openclaw channels login --channel zalouser --account default --verbose
```

### Bot Does Not Reply

Check:

```bash
openclaw status
openclaw channels status
openclaw logs --follow
```

Possible reasons:

- Zalo disconnected.
- New sender needs pairing approval.
- Message is outside business scope and bot stayed silent.
- App server is not running.
- OpenClaw daemon needs restart.

### Bot Uses Old APIs

It should use `/api/assistant/*`.

Fix:

```bash
cp openclaw/zalo/AGENTS.md ~/.openclaw/workspace-zalo/AGENTS.md
cp openclaw/zalo/TOOLS.md ~/.openclaw/workspace-zalo/TOOLS.md
openclaw daemon restart
```

### App Runs On A Different Port

Update `TOOLS.md` and `AGENTS.md` if production port changes.

Current expected order:

1. `http://127.0.0.1:3099`
2. `http://127.0.0.1:3000`

## Security Checklist

- Do not share `~/.openclaw/credentials`.
- Use a separate Zalo account if possible.
- Keep manager approval for refunds, cancellations, payment proof, and price changes.

## Final Go-Live Checklist

Before using with real customers:

1. App is running.
2. Assistant API works with curl.
3. OpenClaw daemon is running.
4. Zalo Personal channel is `OK`.
5. `zalouser` routes to `zalo-business`.
6. `zalo-business` uses `~/.openclaw/workspace-zalo`.
7. Agent sanity check mentions `/api/assistant/*`.
8. Real Zalo menu test works.
9. Customer lookup test works.
10. `/assistant` page shows API logs.
11. Pairing approval flow is understood.
12. Phong knows where to review leads and pending requests.
