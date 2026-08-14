#!/usr/bin/env bash
# deploy_direct_macos.sh
# Full pipeline: build → sign OCIO/RAW resources → DMG → sign → notarize →
# staple → hand off to Store Manager for review/publish.
# Run from the project root: bash scripts/production/deploy_direct_macos.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
# Pinned by SHA-1, not name — the login keychain has carried two valid,
# non-expired "Developer ID Application: ... (RD7UU4Z3D2)" certs at once
# before (one standard 5-year cert, one unexplained ~6-month one), which
# makes codesign refuse with "ambiguous" if you pass the bare name. If this
# hash ever goes stale (cert renewed/revoked), codesign will fail cleanly
# with "identity not found" — re-resolve with:
#   security find-identity -v -p codesigning | grep "Developer ID Application"
# and pick the one whose expiry (`openssl x509 -in <(security find-certificate
# -c "<name>" -a -p) -noout -dates`) matches the long-lived cert you expect.
IDENTITY="2FDD1878C9570F69A38D4231D9E6FC37E92D537F"
KEYCHAIN_PROFILE="cineflow-notary"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIRECT_ENTITLEMENTS="src-tauri/entitlements.direct.plist"

# Store Manager's watched drop folder (see
# /Users/alan/_localDEV/_creative/_store_manager/docs/manifest-schema.md).
# This is the NAS ingest folder, reachable from the Mac via the same SMB
# share licensing-server itself reads from — dropping a manifest.json +
# file here queues it for review in the dashboard, it does NOT publish
# anything automatically. A human still has to Dry-run then Publish.
INGEST_ROOT="/Volumes/Gaia/04_DEV/store-manager/ingest"
PRODUCT_SLUG="cineflow"
PRODUCT_CATEGORY="Apps"

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
echo "[1/7] Building..."
APPLE_SIGNING_IDENTITY="$IDENTITY" npm run build:direct

# ── 2. Sign OCIO/RAW resources ───────────────────────────────────────────────
# Tauri's own build-time signing does not reach arbitrary files staged under
# Contents/Resources/resources/{bin,lib} — only the sidecars/frameworks it
# explicitly knows about via tauri.conf.json. Every dylib and executable
# staged by stage_macos_v12_assets.mjs needs an explicit pass here, or
# notarization rejects the DMG with "not signed with a valid Developer ID
# certificate" / "does not have the hardened runtime enabled" for each one.
# Re-sealing the app (last step below) must run AFTER this, since signing
# nested content changes its bytes and invalidates the outer app's seal.
RES="$APP/Contents/Resources/resources"
if [ -d "$RES" ]; then
  echo "[2/7] Signing OCIO/RAW resources..."
  if [ -d "$RES/lib" ]; then
    find "$RES/lib" -name "*.dylib" -print0 | while IFS= read -r -d '' f; do
      codesign --force --sign "$IDENTITY" --options runtime --timestamp "$f"
    done
  fi
  if [ -d "$RES/bin" ]; then
    find "$RES/bin" -type f -perm -u+x -print0 | while IFS= read -r -d '' f; do
      codesign --force --sign "$IDENTITY" --options runtime --timestamp \
        --entitlements "$DIRECT_ENTITLEMENTS" "$f"
    done
  fi
  echo "[2/7] Re-sealing app bundle..."
  codesign --force --sign "$IDENTITY" --options runtime --timestamp \
    --entitlements "$DIRECT_ENTITLEMENTS" "$APP"
  codesign --verify --deep --strict --verbose=2 "$APP"
else
  echo "[2/7] No bundled OCIO/RAW resources this build — skipping."
fi

# ── 3. Create DMG ─────────────────────────────────────────────────────────────
echo "[3/7] Creating DMG..."
# Tauri's own bundler (step 1) already wrote a DMG at this exact path — if
# left in place, bundle_dmg.sh's internal `hdiutil convert` fails with
# "File exists" and silently leaves that stale, unrelated DMG in place for
# every step after this one (including notarization, which will then reject
# it for reasons that have nothing to do with the real build).
rm -f "$DMG_OUT"

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

# ── 4. Sign DMG ───────────────────────────────────────────────────────────────
echo "[4/7] Signing DMG..."
codesign --sign "$IDENTITY" "$DMG_OUT"

# ── 5. Notarize ───────────────────────────────────────────────────────────────
echo "[5/7] Notarizing (this takes a minute)..."
xcrun notarytool submit "$DMG_OUT" --keychain-profile "$KEYCHAIN_PROFILE" --wait

# ── 6. Staple & validate ──────────────────────────────────────────────────────
echo "[6/7] Stapling..."
xcrun stapler staple "$DMG_OUT"
xcrun stapler validate "$DMG_OUT"
spctl -a -t open --context context:primary-signature "$DMG_OUT"

# ── 7. Hand off to Store Manager ──────────────────────────────────────────────
# Deliberately does NOT write into web_three/licensing-server/releases/
# directly anymore — that bypassed Store Manager's review step and its
# products.js/storeProducts.json bookkeeping entirely, which is exactly the
# kind of drift Store Manager exists to prevent. Instead: archive the
# versioned build locally, then drop a manifest + the DMG (renamed to the
# fixed filename products.js already expects) into the watched ingest
# folder. A human must still open the dashboard and click through
# Dry-run → Publish.
echo "[7/7] Staging for Store Manager review..."

mkdir -p "$BUILD_DEST"
cp "$DMG_OUT" "$BUILD_DEST/$DMG_NAME"
echo "  → builds/direct_distribution/macos/$DMG_NAME (local archive)"

if [ -d "$INGEST_ROOT" ]; then
  DROP_DIR="$INGEST_ROOT/$PRODUCT_CATEGORY/$PRODUCT_SLUG/$VERSION"
  mkdir -p "$DROP_DIR"
  # Fixed filename, not version-suffixed: products.js's existing cineflow
  # entry points at the literal path actual/CineFlow.dmg, and a real
  # Publish for an already-registered product no-ops on products.js (see
  # licensingRepo.ts's addLicenseProduct) rather than rewriting it — so the
  # manifest's declared filename has to already match, or the served path
  # and the file actually on disk after publish will diverge.
  cp "$DMG_OUT" "$DROP_DIR/CineFlow.dmg"
  cat > "$DROP_DIR/manifest.json" <<EOF
{
  "productSlug": "$PRODUCT_SLUG",
  "displayName": "CineFlow Suite",
  "category": "$PRODUCT_CATEGORY",
  "fulfillment": "license",
  "version": "$VERSION",
  "files": { "macos": "CineFlow.dmg" },
  "notifyExisting": false
}
EOF
  echo "  → $DROP_DIR (Store Manager ingest — pending_review once the watcher picks it up)"
  echo ""
  echo "✓ v${VERSION} built, signed, notarized, and queued for review."
  echo ""
  echo "Next: open the Store Manager dashboard, Dry-run, review, then Publish."
  echo "  http://192.168.178.146:5180"
  echo ""
  echo "notifyExisting is set to false above — edit $DROP_DIR/manifest.json"
  echo "before it's picked up (~30s) if this release should email existing buyers."
else
  echo "  ⚠ Store Manager ingest folder not reachable at $INGEST_ROOT"
  echo "    (NAS not mounted?). DMG is built and notarized but not yet queued —"
  echo "    mount the share and manually drop it once available."
fi
