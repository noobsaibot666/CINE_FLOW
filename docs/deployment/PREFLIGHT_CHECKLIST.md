# 🏁 CineFlow Suite: Pre-Flight Audit Checklist

This checklist identifies all lingering placeholders, technical configurations, and environment variables that must be finalized by the developer before the final release builds are generated for submission.

## 🛡️ Identity & Package Configuration

| Location | Key/Field | Current Value | Required Action |
| :--- | :--- | :--- | :--- |
| `src-tauri/Cargo.toml` | `authors` | `["you"]` | **REPLACE** with `["Alan Alves"]` |
| `src-tauri/tauri.conf.json` | `identifier` | `com.exposeu.cineflow` | **VERIFY** matches Apple Developer Identifier. |
| `src-tauri/tauri.conf.json` | `version` | `1.0.0` | **VERIFY** matches Store draft version. |
| `docs/appstore/APP_STORE_DEPLOYMENT.md` | Notarization Commands | `YOUR_APPLE_ID` | **USE** your actual Apple ID in terminal. |

## 🌐 Online Presence

- [ ] **GitHub Pages**: Ensure `docs/index.html` is successfully deployed. Link should be: `https://[your-username].github.io/wrap-preview/`.
- [ ] **Privacy Link**: Verify the above link is accessible and is pasted into the "Privacy Policy" field in App Store Connect.
- [ ] **Support Link**: Ensure the GitHub Issues link (`https://github.com/noobsaibot666/wrap-preview/issues`) is reachable.

## 📦 Bundle Integrity Check

- [ ] **Sidecars**: Ensure `src-tauri/bin/` contains all architectures (x86_64, aarch64) for:
    - `ffmpeg`
    - `ffprobe`
    - `braw_bridge`
    - `REDline`
- [ ] **Signing**: Verify that `npm run tauri build` executes without signing errors. If it fails, check your `Apple Development` and `Apple Distribution` certificates in Keychain.

## 💰 Billing & Submission

- [ ] **Pricing Tier**: Select "Paid" in App Store Connect.
- [ ] **Individual Status**: Verify "Alan Alves" appears as the Seller/Developer name.
- [ ] **Category**: Ensure "Video" (Primary) and "Photo & Video" (Secondary) are selected.

---
**Prepared by Antigravity**
*Pre-submission Audit completed on April 9, 2026.*
