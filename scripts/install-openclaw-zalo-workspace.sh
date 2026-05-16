#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$WEBAPP_DIR/openclaw/zalo"
DEST_DIR="${OPENCLAW_ZALO_WORKSPACE:-$HOME/.openclaw/workspace-zalo}"
RESTART_OPENCLAW=0

usage() {
  cat <<'EOF'
Copy Oli Healthy Zalo bot files into the live OpenClaw workspace.

Usage:
  ./scripts/install-openclaw-zalo-workspace.sh [options]

Options:
  --dest DIR           Destination workspace. Default: ~/.openclaw/workspace-zalo
  --restart-openclaw   Restart OpenClaw daemon after copying.
  -h, --help           Show this help.
EOF
}

log() {
  printf '[openclaw-zalo] %s\n' "$*"
}

die() {
  printf '[openclaw-zalo] ERROR: %s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)
      [[ $# -ge 2 ]] || die "--dest requires a value"
      DEST_DIR="$2"
      shift 2
      ;;
    --restart-openclaw)
      RESTART_OPENCLAW=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

[[ -d "$SOURCE_DIR" ]] || die "Source directory not found: $SOURCE_DIR"

files=(
  AGENTS.md
  TOOLS.md
  OPENCLAW_BOT_SETUP.md
  OPENCLAW_USER_MANUAL.md
  CLIENT_MACHINE_SETUP.md
)

mkdir -p "$DEST_DIR"

for file in "${files[@]}"; do
  [[ -f "$SOURCE_DIR/$file" ]] || die "Missing source file: $SOURCE_DIR/$file"
  cp "$SOURCE_DIR/$file" "$DEST_DIR/$file"
  log "Copied $file"
done

if [[ ! -f "$DEST_DIR/IDENTITY.md" ]]; then
  cat >"$DEST_DIR/IDENTITY.md" <<'EOF'
# IDENTITY

Name: Oli
Role: Zalo customer assistant for Oli Healthy
EOF
  log "Created IDENTITY.md"
fi

if [[ ! -f "$DEST_DIR/SOUL.md" ]]; then
  cat >"$DEST_DIR/SOUL.md" <<'EOF'
# SOUL

Be warm, concise, polite, and service-focused. Use Vietnamese when customers use Vietnamese. Do not give medical advice. Escalate complaints, refunds, cancellations, and payment proof to Phong.
EOF
  log "Created SOUL.md"
fi

if [[ ! -f "$DEST_DIR/USER.md" ]]; then
  cat >"$DEST_DIR/USER.md" <<'EOF'
# USER

Owner: Phong
Business: Oli Healthy
Escalate manager-review requests to Phong through the app's Assistant page.
EOF
  log "Created USER.md"
fi

log "Installed workspace files to $DEST_DIR"

if [[ "$RESTART_OPENCLAW" -eq 1 ]]; then
  command -v openclaw >/dev/null 2>&1 || die "openclaw command not found"
  openclaw daemon restart
fi
