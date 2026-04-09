# App Store Submission & Metadata (macOS)

## 🎯 Marketing Metadata

- **App Name:** CineFlow Suite: Preview & Prep
- **Subtitle:** Professional Creative Suite for Filmmakers & Photographers
- **Category:** Video (Primary), Photo & Video (Secondary)
- **Alt Category:** Productivity

### Store Description
**CineFlow Suite** is an all-in-one professional toolkit designed specifically for **Filmmakers, Photographers, Art Directors, and Cinematographers**. Built for high-stakes production environments, CineFlow empowers you to work **better, faster, and with surgical accuracy**.

Whether you are on-set, in the field, or at your workstation, CineFlow provides a unified suite of micro-apps tailored for visual storytellers:
- **Review Core:** Real-time playback and precision annotation for BRAW, RED, and HLS.
- **Match Lab:** AI-powered shot matching and look analysis for visual consistency.
- **Shot List:** Rapid gear management and high-contrast shot tracking.
- **Micro-Tools:** A growing collection of specialized utilities for technical prep.

Stop context-switching between dozens of disjointed tools. Elevate your production workflow with the power of a modern, local-first Creative Suite.

---

## 🛡️ Sidecars & Sandboxing (CRITICAL)

Your app relies on external binaries (`ffmpeg`, `ffprobe`, `braw-decode`, `REDline`). For the App Store, these **cannot** be found in global paths like `/usr/local/bin`. They must be bundled inside the app and signed.

### 1. Add Binaries as Sidecars

Place your custom-built, static binaries in `src-tauri/bin/`:

- `ffmpeg-x86_64-apple-darwin`
- `ffmpeg-aarch64-apple-darwin`
- `ffprobe-x86_64-apple-darwin`
- etc.

### 2. Update `tauri.conf.json`

Add them to the bundle configuration:

```json
"bundle": {
  "externalBin": [
    "bin/ffmpeg",
    "bin/ffprobe",
    "bin/braw-decode",
    "bin/REDline"
  ],
  ...
}
```

### 3. Signing Sidecars

Apple requires every binary inside your bundle to be signed with your Developer ID. Tauri handles this automatically during `npm run tauri build` if your environment is set up.

---

## 🚀 Final Submission Checklist

Follow these steps to submit **CineFlow Suite** to the macOS App Store.

## 1. Prerequisites

- [ ] Apple Developer Program membership.
- [ ] Xcode installed on your Mac.
- [ ] `APPLE_ID`, `APPLE_PASSWORD` (App-Specific), and `APPLE_TEAM_ID` set in your environment.

## 2. Certificates & Identifiers

- [ ] Create a **Bundle ID** in [Developer Portal](https://developer.apple.com/account/resources/identifiers/list): `com.cineflow.suite`.
- [ ] Create **Mac App Distribution** and **Mac Installer Distribution** certificates.
- [ ] Ensure `entitlements.plist` contains the required sandbox keys.

## 3. App Store Connect

- [ ] Create a new App record in [App Store Connect](https://appstoreconnect.apple.com/).
- [ ] Select the Bundle ID created in step 2.
- [ ] Fill in App Information, Pricing, and Availability.
- [ ] Upload the **Privacy Policy** (provide the link to your hosted `PRIVACY_POLICY.md`).

## 4. Building for Production

Run the following command to generate the signed `.app` and `.pkg`:

```bash
# This will build, sign, and attempt to notarize if credentials are set
npm run tauri build
```

The output will be in `src-tauri/target/release/bundle/macos/`.

## 5. Notarization Check

Tauri's build process usually handles notarization, but you can verify manually:

```bash
xcrun altool --notarize-app --primary-bundle-id "com.cineflow.suite" --username "YOUR_APPLE_ID" --password "YOUR_APP_SPECIFIC_PASSWORD" --file "path/to/your.pkg"
```

## 6. Upload & Review

- [ ] Use **Transporter** app or `xcrun altool` to upload the `.pkg` to App Store Connect.
- [ ] Select the uploaded build in App Store Connect.
- [ ] Submit for Review! 🚀
