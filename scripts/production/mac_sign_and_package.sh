#!/bin/bash
set -e

# --- Configuration ---
PROJECT_ROOT=$(pwd)
APP_PATH="src-tauri/target/release/bundle/macos/CineFlow Suite.app"
IDENTITY="3rd Party Mac Developer Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"

# Support files location
INFRA_DIR="infrastructure/macos"
# Nested executables (no Info.plist of their own) must use app-sandbox + inherit
# so they join the parent app's sandbox instead of failing to resolve their own
# container. entitlements.sidecar.plist grants broad standalone capabilities but
# omits `inherit`, which crashes bare Mach-O sidecars at launch (SIGTRAP, "unable
# to get bundle identifier for container").
SIDECAR_ENTITLEMENTS="src-tauri/entitlements.child.plist"
APP_ENTITLEMENTS="$INFRA_DIR/entitlements.plist"
PROVISION="src-tauri/embedded.provisionprofile"

echo "🧹 Phase 1: Killing circular symlinks..."
find "$APP_PATH" -name "Resources" -type l -path "*/Resources/Resources" -exec rm {} \; || true

echo "🧹 Phase 2: Removing quarantine attributes..."
xattr -rc "$APP_PATH"

echo "📜 Phase 3: Embedding Provisioning Profile..."
xattr -cr "$PROVISION" || true
cp "$PROVISION" "$APP_PATH/Contents/embedded.provisionprofile"
xattr -rc "$APP_PATH"

echo "🛡️  Phase 3b: Signing nested Mach-O inside frameworks (must precede the bundle re-seal)..."
# BlackmagicRawAPI.framework carries loose Mach-O helpers under Versions/A/Libraries/
# (DecoderMetal, DecoderOpenCL, InstructionSetServices*). `codesign` on the
# framework bundle re-seals but does NOT re-sign these — they keep Blackmagic's
# Developer ID signature, which App Store validation rejects ("must be signed
# with the certificate that is contained in the provisioning profile").
find "$APP_PATH/Contents/Frameworks" -type d -name "*.framework" | while read -r FW; do
  find "$FW/Versions" -type f \( -perm -u+x -o -name "*.dylib" \) -not -path "*/_CodeSignature/*" \
    -exec codesign --force --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;
done

echo "🛡️  Phase 4: Signing frameworks..."
find "$APP_PATH/Contents/Frameworks" -name "*.framework" -exec codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;

echo "🛡️  Phase 5: Signing libraries..."
find "$APP_PATH/Contents/Resources/libs" -name "*.dylib" -exec codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;

echo "🛡️  Phase 5b: Signing bundled OCIO/RAW runtime (oiiotool, LibRaw bridge, dependency dylibs)..."
if [ -d "$APP_PATH/Contents/Resources/resources/lib" ]; then
  find "$APP_PATH/Contents/Resources/resources/lib" -name "*.dylib" -exec codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;
fi
if [ -d "$APP_PATH/Contents/Resources/resources/bin" ]; then
  find "$APP_PATH/Contents/Resources/resources/bin" -type f -perm -u+x -exec codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime {} \;
fi

echo "🛡️  Phase 6: Signing sidecars..."
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/REDline"
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/ffmpeg"
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/ffprobe"
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$SIDECAR_ENTITLEMENTS" --options runtime "$APP_PATH/Contents/MacOS/braw_bridge"

echo "🛡️  Phase 7: Signing main app..."
codesign --force --verify --verbose --sign "$IDENTITY" --entitlements "$APP_ENTITLEMENTS" --options runtime "$APP_PATH"
xattr -rc "$APP_PATH"

echo "📦  Phase 8: Generating final Product Archive (.pkg)..."
mkdir -p builds
COPYFILE_DISABLE=1 productbuild --component "$APP_PATH" /Applications --sign "$INSTALLER_IDENTITY" "builds/CineFlow_Suite_SUBMISSION.pkg"

echo "✅ Done! Your final file is in: builds/CineFlow_Suite_SUBMISSION.pkg"
