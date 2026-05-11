#!/usr/bin/env bash
# deploy_direct_macos.sh
# Full pipeline: build → DMG → sign → notarize → staple → distribute
# Run from the project root: bash scripts/production/deploy_direct_macos.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
IDENTITY="Developer ID Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
KEYCHAIN_PROFILE="cineflow-notary"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_RELEASES="/Users/alan/_localDEV/web_three/licensing-server/releases/actual"

cd "$PROJECT_ROOT"

VERSION=$(node -p "require('./package.json').version")
APP="src-tauri/target/release/bundle/macos/CineFlow Suite.app"
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_SCRIPT="$DMG_DIR/bundle_dmg.sh"
DMG_NAME="CineFlow Suite_${VERSION}_aarch64.dmg"
DMG_OUT="$DMG_DIR/$DMG_NAME"
ICON="$DMG_DIR/icon.icns"
BUILD_DEST="builds/direct_distribution/macos"

echo "▶  CineFlow Suite v${VERSION} — Direct Distribution"
echo "────────────────────────────────────────────────────"

# ── 1. Build ──────────────────────────────────────────────────────────────────
echo "[1/6] Building..."
APPLE_SIGNING_IDENTITY="$IDENTITY" npm run build:direct

# ── 2. Create DMG ─────────────────────────────────────────────────────────────
echo "[2/6] Creating DMG..."
STAGING=$(mktemp -d)
cp -R "$APP" "$STAGING/"

bash "$DMG_SCRIPT" \
  --volname "CineFlow Suite" \
  --volicon "$ICON" \
  --background "src-tauri/dgm_bg.png" \
  --window-size 720 460 \
  --icon-size 128 \
  --icon "CineFlow Suite.app" 180 210 \
  --app-drop-link 540 210 \
  --sandbox-safe \
  "$DMG_OUT" \
  "$STAGING"

rm -rf "$STAGING"

# ── 3. Sign DMG ───────────────────────────────────────────────────────────────
echo "[3/6] Signing DMG..."
codesign --sign "$IDENTITY" "$DMG_OUT"

# ── 4. Notarize ───────────────────────────────────────────────────────────────
echo "[4/6] Notarizing (this takes a minute)..."
xcrun notarytool submit "$DMG_OUT" --keychain-profile "$KEYCHAIN_PROFILE" --wait

# ── 5. Staple & validate ──────────────────────────────────────────────────────
echo "[5/6] Stapling..."
xcrun stapler staple "$DMG_OUT"
xcrun stapler validate "$DMG_OUT"
spctl -a -t open --context context:primary-signature "$DMG_OUT"

# ── 6. Distribute ─────────────────────────────────────────────────────────────
echo "[6/6] Distributing..."

# builds archive (versioned filename)
mkdir -p "$BUILD_DEST"
cp "$DMG_OUT" "$BUILD_DEST/$DMG_NAME"
echo "  → builds/direct_distribution/macos/$DMG_NAME"

# web_three releases (fixed filename for the download endpoint)
mkdir -p "$WEB_RELEASES"
cp "$DMG_OUT" "$WEB_RELEASES/CineFlow.dmg"
echo "  → $WEB_RELEASES/CineFlow.dmg"

echo ""
echo "✓ v${VERSION} ready."
echo ""
echo "Next: push web_three and restart the server"
echo "  cd /Users/alan/_localDEV/web_three"
echo "  git add licensing-server/releases/actual/.gitkeep  # if first deploy"
echo "  git push"
echo "  (on server) sudo docker compose down && sudo docker compose up -d"
