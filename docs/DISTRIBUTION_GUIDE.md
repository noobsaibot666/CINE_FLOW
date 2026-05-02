# CineFlow Suite: Distribution & Security Guide

This guide covers the final steps required to distribute the CineFlow Suite to end-users without security warnings on macOS and Windows.

---

## 1. macOS: Code Signing & Notarization
Apple requires all apps distributed outside the App Store to be signed with a **Developer ID Application** certificate and **Notarized**.

### Prerequisites
-   An active **Apple Developer Program** membership ($99/year).
-   Xcode installed on your Mac.

### Step-by-Step Workflow
1.  **Generate Certificate**: Go to [developer.apple.com](https://developer.apple.com), create a "Developer ID Application" certificate, and install it in your Keychain.
2.  **Create App-Specific Password**: Go to [appleid.apple.com](https://appleid.apple.com) and create a password for "Tauri Notarization".
3.  **Configure Environment**:
    Add these to your local `.env` or shell:
    ```bash
    APPLE_ID="your-email@me.com"
    APPLE_PASSWORD="your-app-specific-password"
    APPLE_TEAM_ID="your-team-id"
    ```
4.  **Tauri Configuration**:
    Ensure `tauri.conf.json` has the correct bundle identifier (`com.exposeu.cineflow`).
5.  **Build & Notarize**:
    ```bash
    npm run tauri build -- --bundle dmg
    ```
    Tauri will automatically attempt to notarize if the environment variables are present.

---

## 2. Windows: EV Code Signing
Windows is more restrictive. To avoid the "SmartScreen" blue warning, you **must** use an **Extended Validation (EV) Code Signing Certificate**.

### Prerequisites
-   Purchase an EV Certificate from a provider like **DigiCert** or **Sectigo**. 
    -   *Note: This requires identity verification of your business/studio.*
-   A hardware token (USB) or a cloud-based HSM (Azure Key Vault) to store the certificate.

### Step-by-Step Workflow
1.  **Install SignTool**: Included in the Windows SDK.
2.  **Configure Tauri**:
    In `tauri.conf.json`, under `bundle > windows`, configure the signing settings once you have the certificate thumbprint.
3.  **Build**:
    ```bash
    npm run tauri build -- --bundle msi
    ```
    *Note: Standard (non-EV) certificates will still trigger warnings until the app gains "reputation". EV certificates bypass this immediately.*

---

## 3. Auto-Updater Setup
CineFlow Suite includes a built-in auto-updater. To use it, you must sign your update bundles.

1.  **Generate Update Key**:
    ```bash
    npx tauri signer generate -w ./updater.key
    ```
    **KEEP THIS KEY SECRET.**
2.  **Add Public Key to Tauri**:
    Copy the generated **Public Key** into `tauri.conf.json` under `plugins > updater > pubkey`.
3.  **Update Server**:
    When you release a new version, upload the `.sig` file and the bundle to your NAS storage and update the `update.json` manifest.

---

## Summary of Next Actions
1.  [ ] **Apple**: Create the Developer ID certificate.
2.  [ ] **Windows**: Order the EV Code Signing certificate (takes ~3-7 days for verification).
3.  [ ] **Updater**: Generate the keys once we are ready for the first "Gold" build.
