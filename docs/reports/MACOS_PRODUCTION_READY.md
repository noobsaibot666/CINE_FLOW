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
- **Identifier**: `com.exposeu.cineflow`
- **Category (LSApplicationCategoryType)**: `public.app-category.video` (Set in `bundle > macOS > infoPlist`)
- **Version**: `1.0.0-rc.1` (Release Candidate)

## Next Steps (Submission)

1. **Verify Bundle ID**: Ensure `com.exposeu.cineflow` is registered in your [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list).
2. **App Store Connect**: Create a new App record in [App Store Connect](https://appstoreconnect.apple.com/) using this identifier.
3. **Generate Submission Package**: Run the following to generate the `.pkg` file:
   ```bash
   npx tauri build
   ```
4. **Upload**: Use the **Transporter** app (available on the Mac App Store) to drag and drop the `.pkg` file from `src-tauri/target/release/bundle/macos/`.
5. **Submit for Review**: Once uploaded, select the build in App Store Connect and submit!
