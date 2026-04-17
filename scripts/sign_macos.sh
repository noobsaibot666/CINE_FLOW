#!/bin/bash
set -e

APP_PATH="src-tauri/target/release/bundle/macos/CineFlow Suite.app"
IDENTITY="3rd Party Mac Developer Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
SIDECAR_ENTITLEMENTS="src-tauri/entitlements.sidecar.plist"
APP_ENTITLEMENTS="src-tauri/entitlements.app.plist"
PROVISION="src-tauri/embedded.provisionprofile"

echo "🧹 Phase 1: Killing circular symlinks..."
# We search for the specific broken Qt pattern and remove it
find "$APP_PATH" -name "Resources" -type l -path "*/Resources/Resources" -exec rm {} \; || true

echo "📜 Phase 2: Embedding Provisioning Profile..."
cp "$PROVISION" "$APP_PATH/Contents/embedded.provisionprofile"

echo "🧹 Phase 3: Removing quarantine attributes..."
# Must run AFTER embedding the profile so the copied file is also cleaned
xattr -rc "$APP_PATH"

echo "🛡️  Phase 4: Signing frameworks..."
find "$APP_PATH/Contents/Frameworks" -name "*.framework" -exec codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;

echo "🛡️  Phase 5: Signing libraries..."
find "$APP_PATH/Contents/Resources/libs" -name "*.dylib" -exec codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;

echo "🛡️  Phase 6: Signing sidecars..."
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/REDline"
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/ffmpeg"
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/ffprobe"
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/braw_bridge"

echo "🛡️  Phase 7: Signing main app..."
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$APP_ENTITLEMENTS" --options runtime "$APP_PATH"

echo "📦  Phase 8: Generating final Product Archive (.pkg)..."
productbuild --component "$APP_PATH" /Applications --sign "3rd Party Mac Developer Installer: Nudson Alan Terrinha Alves (RD7UU4Z3D2)" "builds/CineFlow_Suite_SUBMISSION.pkg"

echo "✅ Done! Your final file is in: builds/CineFlow_Suite_SUBMISSION.pkg"
