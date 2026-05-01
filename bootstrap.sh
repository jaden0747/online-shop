#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/jaden0747/online-shop.git"
APP_DIR="$HOME/shop-organizer"

echo "==> Shop Organizer bootstrap"

# ── Homebrew ──────────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "==> Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon: add brew to PATH for this session
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
else
  echo "==> Homebrew already installed"
fi

# ── Node.js (via nvm) ─────────────────────────────────────────────────────────
if ! command -v nvm &>/dev/null; then
  echo "==> Installing nvm..."
  brew install nvm
  mkdir -p "$HOME/.nvm"
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  source "$(brew --prefix nvm)/nvm.sh"
else
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  [ -s "$(brew --prefix nvm)/nvm.sh" ] && source "$(brew --prefix nvm)/nvm.sh"
fi

echo "==> Installing Node.js LTS..."
nvm install --lts
nvm use --lts

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

# ── nvm shell setup reminder ──────────────────────────────────────────────────
SHELL_RC="$HOME/.zshrc"
if ! grep -q 'NVM_DIR' "$SHELL_RC" 2>/dev/null; then
  echo "" >> "$SHELL_RC"
  echo '# nvm' >> "$SHELL_RC"
  echo 'export NVM_DIR="$HOME/.nvm"' >> "$SHELL_RC"
  echo '[ -s "$(brew --prefix nvm)/nvm.sh" ] && source "$(brew --prefix nvm)/nvm.sh"' >> "$SHELL_RC"
  echo "==> Added nvm to $SHELL_RC"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "==> Done! To start the app:"
echo ""
echo "    cd $APP_DIR"
echo "    npm run build && npm start"
echo ""
echo "    Then open http://localhost:3000"
echo ""
