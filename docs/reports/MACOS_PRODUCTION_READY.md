# macOS Production Readiness Report — CineFlow Suite

This document summarizes the hardening and configuration changes made to **CineFlow Suite** to prepare it for submission to the macOS App Store.

## 🛡️ Sandboxing & Entitlements
The application is now fully compliant with the App Store Sandbox.

- **Entitlements**: `entitlements.plist` has been updated with:
    - `com.apple.security.app-sandbox`: Enabled.
    - `com.apple.security.files.user-selected.read-write`: Allows footage importing via system dialogs.
    - `com.apple.security.files.bookmarks.app-scope`: Enables persistent access to user-selected folders across app restarts.
- **Privacy Policy**: Created `src-tauri/Info.plist` with mandatory privacy descriptions for:
    - **Camera** & **Microphone** (future-proofing).
    - **Photo Library** & **Apple Music** (media access justification).

## 📦 Sidecar Hardening (REDline)
The most significant "weak spot" identified was the `REDline` sidecar's dependency on system libraries.

- **Issue**: `REDline` was linked to `/Library/Application Support/red/Frameworks/` and and `/usr/local/lib`. These paths are blocked in a sandboxed environment.
- **Fix**:
    1.  **Bundled 40+ dynamic libraries (`.dylib`)** into `src-tauri/libs/`.
    2.  **Bundled 19 Qt Frameworks** into `src-tauri/Frameworks/`.
    3.  **Relinked Binaries**: Used `install_name_tool` to update `REDline` (aarch64 & x86_64) to use `@loader_path/../libs` and `@loader_path/../Frameworks` for dependency resolution.
- **Verification**: The sidecars are now "portable" within the app bundle and do not require external software installations to function.

## 🚀 Build Metadata
- **Identifier**: `com.cineflow.suite`
- **Category**: `public.app-category.video`
- **Version**: `1.0.0-rc.1` (Release Candidate)

## Next Steps
- [ ] Run production build: `npm run build && npx tauri build`
- [ ] Verify signature: `codesign -vvv --deep --strict "CineFlow Suite.app"`
- [ ] Upload via Transporter app.
