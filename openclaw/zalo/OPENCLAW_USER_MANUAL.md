# OpenClaw Zalo Bot User Manual

This file summarizes the current OpenClaw setup for the Oli Healthy Zalo bot and explains how to configure, train, test, and operate it.

## What Has Been Set Up

### App-Side API

The app already exposes a safe assistant API under:

```text
/api/assistant/*
```

The bot should use these endpoints instead of the older unauthenticated app endpoints.

Main API abilities:

- support the current bot phase
- log assistant actions

Current bot phase scope:

- answer shipping fee questions
- answer questions about how the shop operates

Everything else is intentionally out of scope for now.

The app manager UI is available at:

```text
/assistant
```

Use it to review:

- customer leads
- pending review requests
- assistant API logs

### OpenClaw Workspace

The Zalo bot uses a dedicated OpenClaw agent:

```text
zalo-business
```

The live OpenClaw workspace is:

```text
~/.openclaw/workspace-zalo
```

The repo contains the versioned source files here:

```text
openclaw/zalo/
```

Files created:

- `openclaw/zalo/AGENTS.md`
- `openclaw/zalo/TOOLS.md`
- `openclaw/zalo/OPENCLAW_BOT_SETUP.md`
- `openclaw/zalo/OPENCLAW_USER_MANUAL.md`

The live OpenClaw files were updated from the repo copies:

```text
~/.openclaw/workspace-zalo/AGENTS.md
~/.openclaw/workspace-zalo/TOOLS.md
~/.openclaw/workspace-zalo/OPENCLAW_BOT_SETUP.md
```

### Verification Already Done

Verified:

- OpenClaw daemon restarted successfully.
- OpenClaw gateway is reachable.
- Zalo Personal channel status is `OK`.
- Zalo channel routes to the `zalo-business` agent.
- Assistant API works against `/api/assistant/menu`.
- `zalo-business` agent loaded the new `/api/assistant/*` instructions.

## Architecture

```text
Customer on Zalo
  -> OpenClaw Zalo Personal channel
  -> OpenClaw gateway
  -> zalo-business agent
  -> Oli Healthy assistant API
  -> App data files
  -> /assistant manager UI for logs/reviews
```

The bot should not edit Excel files directly.

The bot should not call the old endpoints:

```text
/api/customers
/api/subscriptions
/api/menu
/api/pricing
```

The bot should call:

```text
/api/assistant/*
```

However, the current phase does not approve general use of those endpoints yet. The detailed allowed behavior should be defined in:

- `openclaw/zalo/AGENTS.md`
- `openclaw/zalo/TOOLS.md`

## Important OpenClaw Paths

Main OpenClaw config:

```text
~/.openclaw/openclaw.json
```

Zalo bot workspace:

```text
~/.openclaw/workspace-zalo
```

Main/default workspace:

```text
~/.openclaw/workspace
```

Agent state:

```text
~/.openclaw/agents/
```

Logs:

```text
~/.openclaw/logs/
```

Credentials:

```text
~/.openclaw/credentials/
```

Do not commit or share anything from `~/.openclaw/credentials`.

## Key OpenClaw Commands

### Status

```bash
openclaw status
```

Use this first. It shows:

- gateway status
- channel status
- active agents
- sessions
- model
- update status

For deeper checks:

```bash
openclaw status --deep
```

### Start / Stop / Restart

```bash
openclaw daemon start
openclaw daemon stop
openclaw daemon restart
```

Restart after changing:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/workspace-zalo/AGENTS.md`
- `~/.openclaw/workspace-zalo/TOOLS.md`
- environment variables used by OpenClaw

### Logs

```bash
openclaw logs --follow
```

Use this while testing real Zalo messages.

### Channel Status

```bash
openclaw channels status
```

Expected:

```text
Zalo Personal | ON | OK
```

### Zalo Login

If Zalo is not configured or disconnected:

```bash
openclaw channels login --channel zalouser --account default --verbose
```

Scan the QR code with Zalo if prompted.

### Pairing New Customers

The current Zalo config uses pairing.

Watch logs:

```bash
openclaw logs --follow
```

If OpenClaw prints a pairing code, approve it:

```bash
openclaw pairing approve zalouser CODE
```

### Config File

Show config path:

```bash
openclaw config file
```

Read config values:

```bash
openclaw config get agents.list
openclaw config get bindings
openclaw config get channels.zalouser
openclaw config get agents.defaults.model.primary
```

### Test Agent Manually

Run one agent turn without sending to Zalo:

```bash
openclaw agent --agent zalo-business --message "Sanity check. What endpoint do you use for menu lookup?"
```

Send a message through a channel only when you are ready:

```bash
openclaw agent --agent zalo-business --message "..." --deliver --reply-channel zalouser --reply-to TARGET_ID
```

For command details:

```bash
openclaw agent --help
```

## App Server Requirements

The bot needs the app API running.

Production/Electron:

```text
http://127.0.0.1:3099
```

Development:

```text
http://127.0.0.1:3000
```

The bot instructions tell OpenClaw to try `3099` first and fall back to `3000`.

Start dev server:

```bash
npm run dev
```

If Next says a server is already running, use the existing URL shown in the message.

## Local API Check

Test the local API:

```bash
BASE_URL="http://127.0.0.1:3000"

curl -s "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

Expected: JSON menu response.

If you get:

- connection error: app server is not running or wrong port

## How To Configure The Bot

The main behavior files are:

```text
openclaw/zalo/AGENTS.md
openclaw/zalo/TOOLS.md
```

Live files:

```text
~/.openclaw/workspace-zalo/AGENTS.md
~/.openclaw/workspace-zalo/TOOLS.md
```

Recommended workflow:

1. Edit files in `openclaw/zalo/`.
2. Copy them to `~/.openclaw/workspace-zalo/`.
3. Restart OpenClaw.
4. Test with `openclaw agent --agent zalo-business`.
5. Test with a real Zalo message.

Copy command:

```bash
cp openclaw/zalo/AGENTS.md ~/.openclaw/workspace-zalo/AGENTS.md
cp openclaw/zalo/TOOLS.md ~/.openclaw/workspace-zalo/TOOLS.md
openclaw daemon restart
```

## How To Train The Bot

In this setup, "training" mostly means updating instruction files and testing behavior. You are not fine-tuning a model.

### Train Business Rules

Edit:

```text
openclaw/zalo/AGENTS.md
```

Use this file for:

- what the bot can and cannot do
- conversation flows
- escalation rules
- customer tone
- rules for confirmations
- rules for silence/out-of-scope messages

Example changes:

- "Always ask for phone before account lookup."
- "Never confirm payment automatically."
- "Create renewal request instead of creating subscription."
- "Use Vietnamese unless customer uses English."

### Train Tool Usage

Edit:

```text
openclaw/zalo/TOOLS.md
```

Use this file for:

- API endpoints
- curl examples
- required headers
- response/error handling
- fallback ports

Update this file whenever app API endpoints change.

### Train Tone

Edit live or repo copy:

```text
~/.openclaw/workspace-zalo/SOUL.md
```

or create a repo copy later if we want to version it.

Use this file for:

- personality
- greeting style
- Vietnamese politeness
- emoji policy
- customer service boundaries

### Train Owner/Escalation Context

Edit:

```text
~/.openclaw/workspace-zalo/USER.md
```

Use this for:

- who Phong is
- when to escalate
- owner preferences
- business constraints

### Train By Examples

Add concrete examples to `AGENTS.md`.

Good examples:

```text
Customer: Em muốn skip ngày mai.
Bot: Dạ ngày mai là Chủ Nhật, bên em không giao Chủ Nhật. Anh/chị muốn skip ngày giao tiếp theo là Thứ Hai 18/05 không ạ?
```

```text
Customer: Cho chị đổi bữa thứ 2 sang option A.
Bot: Dạ em sẽ đổi bữa Thứ Hai 18/05 sang Option A cho gói weekly cutting của chị. Chị xác nhận giúp em nhé?
```

Examples are one of the best ways to shape bot behavior.

## What The Bot Can Currently Do

### Read-Only

- answer menu questions
- look up customer by phone
- summarize active/upcoming subscription
- show current week meal selections
- show saved/default addresses
- show upcoming skips

### Direct Writes After Customer Confirmation

- update meal selections
- skip a valid delivery day
- set temporary delivery address from saved addresses

### Creates Manager Review / Pending Work

- new customer lead
- renewal request

## What The Bot Should Not Do Automatically

- cancel a subscription
- issue refund
- confirm payment as paid
- change subscription price
- change phone number
- permanently replace default address with new unverified address
- delete data
- expose internal financials
- expose manager-only notes

## Customer Usage Examples

Customers can message things like:

```text
Menu hôm nay có gì?
```

```text
Chị muốn chọn option A cho ngày mai.
```

```text
Em muốn skip thứ 6 tuần này.
```

```text
Gói của anh còn mấy ngày?
```

```text
Chị muốn gia hạn gói hiện tại.
```

```text
Em là khách mới, muốn đăng ký gói weekly cutting 2 bữa/ngày.
```

The bot should ask for phone number when it needs account access.

## Manager Usage Flow

Daily flow:

1. Start/open the Oli Healthy app.
2. Check OpenClaw:

```bash
openclaw status
```

3. Check Zalo:

```bash
openclaw channels status
```

4. Watch logs if needed:

```bash
openclaw logs --follow
```

5. Review app assistant activity:

```text
/assistant
```

6. Approve/reject leads and review requests.

## Testing Checklist

Before relying on the bot:

1. App server is running.
2. `openclaw status` shows gateway reachable.
3. `openclaw channels status` shows Zalo Personal `OK`.
4. Menu endpoint works with curl.
5. Customer lookup works with curl.
6. `openclaw agent --agent zalo-business` references `/api/assistant/*`.
7. `/assistant` page shows API logs after test calls.
8. Real Zalo test message gets a correct response.

## Troubleshooting

### Bot Does Not Reply

Check:

```bash
openclaw status
openclaw channels status
openclaw logs --follow
```

Possible causes:

- Zalo channel disconnected.
- New sender needs pairing approval.
- Message is out of business scope and bot is intentionally silent.
- OpenClaw daemon needs restart.
- Model/provider error.

### API Calls Fail

Test manually:

```bash
BASE_URL="http://127.0.0.1:3000"
curl -s -i "$BASE_URL/api/assistant/menu?date=$(date +%F)"
```

Possible causes:

- app server not running
- wrong port

### OpenClaw Uses Old Instructions

Copy repo files to live workspace:

```bash
cp openclaw/zalo/AGENTS.md ~/.openclaw/workspace-zalo/AGENTS.md
cp openclaw/zalo/TOOLS.md ~/.openclaw/workspace-zalo/TOOLS.md
openclaw daemon restart
```

Then test:

```bash
openclaw agent --agent zalo-business --message "What endpoint do you use for menu lookup?"
```

Expected answer should mention:

```text
/api/assistant/menu
```

### Zalo Shows SETUP

Run:

```bash
openclaw channels login --channel zalouser --account default --verbose
```

### New Customer Cannot Talk To Bot

They may need pairing approval.

Watch logs:

```bash
openclaw logs --follow
```

Approve:

```bash
openclaw pairing approve zalouser CODE
```

## Maintenance Notes

- Keep `openclaw/zalo/AGENTS.md` and `openclaw/zalo/TOOLS.md` as the source of truth.
- After changing repo files, copy to `~/.openclaw/workspace-zalo`.
- Restart OpenClaw after changes.
- Review `/assistant` logs regularly during early bot testing.

## Current Known State

As of setup:

- OpenClaw daemon is installed as a LaunchAgent.
- Gateway is reachable.
- Zalo Personal channel is configured and `OK`.
- Zalo messages route to `zalo-business`.
- `zalo-business` uses `~/.openclaw/workspace-zalo`.
- The assistant API was verified on `http://127.0.0.1:3000`.
