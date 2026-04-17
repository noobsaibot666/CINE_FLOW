# 🚀 CineFlow Suite Deployment Manual

This document outlines the steps to build and ship CineFlow Suite to the Apple Mac App Store.

## 🍎 macOS App Store Submission

To ship a new version to Apple:

1. **Rebuild the project**:
   ```bash
   npx tauri build
   ```

2. **Run the signing automation**:
   ```bash
   ./scripts/production/mac_sign_and_package.sh
   ```

3. **Upload**:
   Drag the resulting folder from `builds/CineFlow_Suite_SUBMISSION.pkg` into **Transporter**.

---

## 🏗️ Technical Infrastructure
- **Entitlements**: Located in `infrastructure/macos/`
- **Provisioning**: Managed via `src-tauri/embedded.provisionprofile`
- **Certificates**: Ensure "3rd Party Mac Developer" identities are valid in Keychain.

## 📦 Build Artifacts
Final binaries are generated in the `/builds` directory. This directory is ignored by Git to avoid repo bloat.
