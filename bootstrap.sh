#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/jaden0747/online-shop.git"
APP_DIR="$HOME/shop-organizer"

echo "==> Shop Organizer bootstrap"

# ── Homebrew ──────────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "==> Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
else
  echo "==> Homebrew already installed"
fi

# Ensure brew is on PATH for Apple Silicon macs
if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# ── Node.js (via Homebrew — no PATH sourcing needed) ─────────────────────────
if ! command -v node &>/dev/null; then
  echo "==> Installing Node.js..."
  brew install node
else
  echo "==> Node $(node --version) already installed"
fi

echo "==> Node $(node --version) / npm $(npm --version)"

# ── Clone repo ────────────────────────────────────────────────────────────────
if [[ -d "$APP_DIR" ]]; then
  echo "==> $APP_DIR already exists, pulling latest..."
  git -C "$APP_DIR" pull
else
  echo "==> Cloning repo..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ── Install dependencies ──────────────────────────────────────────────────────
echo "==> Installing npm dependencies..."
npm install

# ── Data directory ────────────────────────────────────────────────────────────
mkdir -p data

if [[ ! "$(ls -A data/*.xlsx 2>/dev/null)" ]]; then
  echo ""
  echo "  ⚠️  No data files found in $APP_DIR/data/"
  echo "  Copy your Excel files from your old machine:"
  echo ""
  echo "    scp old-mac:~/path/to/shop-organizer/webapp/data/*.xlsx $APP_DIR/data/"
  echo ""
  echo "  Required files:"
  echo "    customers.xlsx  addresses.xlsx  subscriptions.xlsx"
  echo "    menu.xlsx       selections.xlsx  notes.xlsx"
  echo "    pricing.xlsx    orders.xlsx"
  echo ""
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "==> Building app..."
npm run build

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo "==> Starting app..."
echo "    Open http://localhost:3000 in your browser (Ctrl+C to stop)"
echo ""
npm start
