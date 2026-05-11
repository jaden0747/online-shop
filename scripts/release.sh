#!/usr/bin/env bash
# Usage: ./scripts/release.sh [version]
#   version -- e.g. 1.2.3  (omit to use the version already in package.json)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load GH_TOKEN from .env if not already set
if [ -z "${GH_TOKEN:-}" ] && [ -f "$ROOT/.env" ]; then
  GH_TOKEN="$(grep -E '^GH_TOKEN=' "$ROOT/.env" | cut -d= -f2- | tr -d '[:space:]')"
  export GH_TOKEN
fi

if [ -z "${GH_TOKEN:-}" ]; then
  echo "Error: GH_TOKEN is not set. Add it to .env or export it in your shell." >&2
  exit 1
fi

# Resolve version
CURRENT_VERSION="$(node -p "require('./package.json').version")"

if [ -n "${1:-}" ]; then
  NEW_VERSION="$1"
else
  NEW_VERSION="$CURRENT_VERSION"
fi

# Validate semver format
case "$NEW_VERSION" in
  [0-9]*.[0-9]*.[0-9]*) ;;
  *)
    echo "Error: version must be X.Y.Z (got '$NEW_VERSION')" >&2
    exit 1
    ;;
esac

echo "==> Version: $NEW_VERSION"

# Bump version in package.json if needed
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "==> Bumped package.json: $CURRENT_VERSION -> $NEW_VERSION"
fi

TAG="v${NEW_VERSION}"

# Check tag does not already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag $TAG already exists. Bump the version first." >&2
  exit 1
fi

# Build
echo "==> Building Next.js + Electron (this takes a few minutes)..."
rm -rf .next
npx next build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
cp node_modules/next/dist/compiled/next-server/*.runtime.prod.js .next/standalone/node_modules/next/dist/compiled/next-server/

echo "==> Packaging and publishing to GitHub..."
npx electron-builder --mac --publish always

# Commit + tag
echo "==> Committing and tagging ${TAG}..."
git add package.json
git commit -m "chore: bump version to $NEW_VERSION" || echo "(nothing to commit -- version already at $NEW_VERSION)"
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"

echo ""
echo "Done: released $TAG"
echo "Check: https://github.com/jaden0747/online-shop/releases"
