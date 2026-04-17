# 📦 CineFlow Suite - Store Submission Checklist

This document tracks all visual and written assets required for the macOS App Store and Microsoft Windows Store.

## 📁 Suggested Folder Structure
- `assets/store/`
    - `macOS/`
        - `icons/` (AppIcon.icns, master_1024.png)
        - `screenshots/` (01_Dashboard.png, 02_ReviewCore.png, 03_MatchLab.png, 04_ShotList.png)
    - `windows/`
        - `icons/` (StoreLogo.png, Square150x150.png, etc.)
        - `screenshots/` (01_WindowsMain.png, etc.)

---

## 🍎 macOS App Store Requirements

### 1. App Icon
- **Master Image:** 1024 x 1024 px (PNG, no transparency)
- **Bundle Format:** `.icns` file (automatically managed by Tauri from `icons/` folder)

### 2. Screenshots (Min 3, Max 10)
- **Primary Size:** 2560 x 1600 px (16:10 aspect ratio)
- **Alternative:** 1280 x 800 px
- **Target Context:**
    - **Dashboard**: Showing the Creative Suite high-level view.
    - **Review Core**: Demonstrating BRAW/RED playback and annotations.
    - **Match Lab**: Highlighting AI shot matching and LUT analysis.
    - **Shot List**: Displaying the high-contrast gear tracking.

---

## 🪟 Microsoft Store Requirements

### 1. App Icons (MSIX Style)
- **Store Logo:** 50 x 50 px
- **Square 150x150 Logo:** 150 x 150 px
- **Square 44x44 Logo:** 44 x 44 px (for Taskbar)
- **Wide 310x150 Logo:** 310 x 150 px

### 2. Screenshots
- **Size:** 1920 x 1080 px (16:9 aspect ratio)
- **Requirement:** At least 1 screenshot is mandatory; 4-6 recommended for conversion.

---

## ✅ Final Developer Certification
- [x] **Privacy Policy:** Hosted at `index.html` (GitHub Pages)
- [x] **Pricing Strategy:** Defined (v1 purchase, v2 50% discount)
- [ ] **Release Build:** Run `npm run tauri build` to generate signed final installers.
- [ ] **Version Sync:** Ensure `tauri.conf.json` matches store listing.
