# CineFlow Suite: Distribution Guide

## Bundle Identifiers

CineFlow Suite ships under **two different bundle identifiers** depending on distribution channel. This is intentional — macOS sandbox containers are bound to the signing identity that created them, so mixing App Store and Developer ID builds on the same machine causes a launch conflict.

| Channel             | Identifier                     | Certificate                          |
| ------------------- | ------------------------------ | ------------------------------------ |
| Mac App Store       | `com.exposeu.cineflow`         | 3rd Party Mac Developer Application  |
| Direct Distribution | `com.exposeu.cineflow-direct`  | Developer ID Application             |

The direct build uses `src-tauri/tauri.direct.conf.json` + `src-tauri/entitlements.direct.plist` to override the identifier at build time. App data (license, trial, DB, cache) lives in separate containers — no cross-contamination.

---

## macOS Direct Distribution Build

### Prerequisites

- Active Apple Developer Program membership
- **Developer ID Application** certificate installed in Keychain (not the App Store cert)
- Developer ID Certification Authority G2 intermediate cert installed
- App-specific password from [appleid.apple.com](https://appleid.apple.com)
- `.env` file at project root:

```bash
APPLE_ID="alan.creative@icloud.com"
APPLE_PASSWORD="your-app-specific-password"
APPLE_TEAM_ID="RD7UU4Z3D2"
```

### Build

```bash
set -a && source .env && set +a
export APPLE_SIGNING_IDENTITY="Developer ID Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
NODE_OPTIONS="--max-old-space-size=4096" npm run build:direct
```

Run from Terminal (not from IDE) — the frontend build requires more memory than the VSCode extension process allows.

### DMG Creation

Tauri's `bundle_dmg.sh` cannot access signed `.app` bundles from sandboxed processes. Create the DMG manually from Terminal after the build:

```bash
cd /path/to/exposeu_wrapkit

IDENTITY="Developer ID Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)"
APP="src-tauri/target/release/bundle/macos/CineFlow Suite.app"
ENT="src-tauri/entitlements.direct.plist"
TMP="/tmp/cineflow_final.dmg"
DMG="src-tauri/target/release/bundle/dmg/CineFlow Suite_1.0.4_aarch64.dmg"

# Sign all dylibs (Resources/libs has 45 vendor dylibs; find -exec breaks on paths with spaces)
while IFS= read -r -d '' f; do
  codesign --force --options runtime --timestamp -s "$IDENTITY" "$f"
done < <(find "$APP/Contents/Resources/libs" -name "*.dylib" -print0)

while IFS= read -r -d '' f; do
  [[ "$(basename "$f")" == "cineflow-suite" ]] && continue
  codesign --force --options runtime --timestamp -s "$IDENTITY" "$f"
done < <(find "$APP/Contents/MacOS" -type f -print0)

while IFS= read -r -d '' f; do
  codesign --force --options runtime --timestamp -s "$IDENTITY" "$f"
done < <(find "$APP/Contents/Frameworks" \( -name "*.dylib" -o -name "*.framework" \) -print0)

codesign --force --options runtime --timestamp --entitlements "$ENT" \
  -s "$IDENTITY" "$APP/Contents/MacOS/cineflow-suite"

codesign --force --options runtime --timestamp --entitlements "$ENT" \
  -s "$IDENTITY" "$APP"

codesign --verify --deep --strict "$APP" && echo "Signature OK"

# The app is ~366MB uncompressed — needs a 600MB volume
hdiutil create -size 600m -fs APFS -volname "CineFlowSuite" "$TMP" -ov
hdiutil attach "$TMP" -mountpoint /Volumes/CineFlowSuite
cp -R "$APP" "/Volumes/CineFlowSuite/CineFlow Suite.app" && echo "Copy OK"
ln -s /Applications "/Volumes/CineFlowSuite/Applications"
hdiutil detach /Volumes/CineFlowSuite
rm -f "$DMG"
hdiutil convert "$TMP" -format UDZO -o "$DMG"
codesign --force --timestamp -s "$IDENTITY" "$DMG"
echo "Done: $(ls -lh "$DMG")"
```

### Notarization & Stapling

```bash
source .env
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" \
  --wait

xcrun stapler staple "$DMG"
```

If `notarytool --wait` times out (Apple can take 5–60 min for large files), poll manually:

```bash
xcrun notarytool info <submission-id> \
  --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID"
# When status is Accepted:
xcrun stapler staple "$DMG"
```

### Key gotchas

- **`find -exec` breaks on paths with spaces** — always use `find -print0 | while IFS= read -r -d '' f` when signing inside the bundle.
- **APFS volume must be ≥600MB** — the uncompressed `.app` is ~366MB; HFS+ at 250MB silently fails mid-copy, producing a DMG that passes local verification but fails Apple's notarization.
- **Broken Qt symlinks** — the bundled Qt frameworks ship with self-referential `Versions/5/Resources/Resources` symlinks that Gatekeeper rejects. These have been removed from `src-tauri/Frameworks/` and the build output. If they reappear after a Qt upgrade, delete them: `find "$APP" -type l -name "Resources" ! -e -delete`.
- **Sandbox container conflict** — never test with a build signed by a different identity on the same machine without first clearing `~/Library/Containers/com.exposeu.cineflow-direct/`. The direct and App Store builds use different identifiers to avoid this problem across machines.

---

## Mac App Store Build

Use the standard `npm run build` (no `--features direct-dist`, no config override). The App Store build has no licensing/trial system.

---

## Windows

Windows builds and EV code signing are handled on the Windows side. See `docs/WINDOWS_DEVELOPMENT.md`.
