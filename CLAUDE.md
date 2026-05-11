# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CineFlow Suite is a macOS and Windows desktop application for film production professionals — on-set media verification, camera matching, and post-production prep. Built with Tauri 2 (Rust backend) + React 18/TypeScript (frontend).

## Commands

```bash
npm install

npm run dev

npm run tauri dev

npm run lint

npm run test

npm run build

# Build for direct distribution (with licensing)
npm run build:direct

cargo check --manifest-path src-tauri/Cargo.toml

npx tauri build
```

`npm run lint` is the TypeScript strict check (`tsc --noEmit`). `npm run test` currently aliases lint because no dedicated test framework is configured.

**After every change, verify:** `npm run lint`, `npm run test`, `npm run build`, and `cargo check --manifest-path src-tauri/Cargo.toml` when Rust/Tauri code may be affected.
**Versioning:** All versions (`package.json`, `Cargo.toml`, `tauri.conf.json`) must remain synchronized.

## Architecture

**Frontend** (`src/`)

- `App.tsx` (~5k lines): top-level component that routes all modules and manages global state
- `src/components/`: reusable UI components (ClipList, ClipCard, SafeCopy, ExportPanel, ReviewCore pieces)
- `src/modules/`: high-level feature bundles organized by workflow stage (PreProduction, Production)
- `src/hooks/`: custom React hooks for keyboard shortcuts, IPC listeners, selection state, command palette
- `src/utils/`: business logic helpers — export generation (PDF/image/FCPXML), clip metadata, IPC wrappers
- `src/branding/`: all design tokens — **all styling must use these tokens; never introduce new color/typography/spacing systems**
- `index.css` (~10k lines): raw CSS variables and base styles

**Backend** (`src-tauri/src/`)

- `commands.rs` (~7.6k lines): all Tauri IPC commands exposed to the frontend
- `db.rs` (~5k lines): SQLite schema and all database access
- `production_calibration.rs`: OpenCV-based color/exposure analysis (behind `calibration` feature flag)
- `production_match_lab.rs`: multi-camera matching logic
- `thumbnail.rs`: frame extraction via FFmpeg
- `ffprobe.rs`: media metadata extraction
- `verification.rs`: Blake3 hashing for Safe Copy integrity checks
- `license.rs`: Self-hosted licensing logic (feature-gated via `direct-dist`)
- `review_core/`: local annotation server (processor, server, storage)

**IPC pattern:** frontend calls `invoke('command_name', { params })` and listens with `listen('event_name')`. All heavy media operations run in the Rust backend job queue and emit progress events — never block the UI thread.

**Database:** SQLite at `~/.cache/cineflow-suite/cineflow-suite.db`. Key tables: `production_matchlab_runs`, `production_matchlab_results`, `production_matchlab_sources`, `jobs`, `clips`.

**External binaries** (bundled in `src-tauri/bin/`, git-ignored): FFmpeg, FFprobe, braw_bridge, REDline.

## Development Rules

These rules come from `docs/AI_DEV_RULES.md` and `docs/AI_UI_CONTRACT.md` — follow them strictly:

1. **Extend, don't replace.** Add to existing components rather than rewriting them. Prefer minimal, surgical edits.
2. **No UI drift.** Never redesign layouts, move major sections, change component hierarchy, or introduce new color/typography systems. Use `src/branding` tokens exclusively.
3. **Production stability first.** Be conservative with changes to the media pipeline, proxy generation, frame extraction, and export system — these run during live shoots.
4. **Deterministic behavior.** All media analysis must remain deterministic. No randomness or unstable heuristics.
5. **Camera Match Lab layout is frozen.** The layout contract (Header → Control row → 3-column camera grid with file info/frame preview/histogram/metrics/deltas/adjustments) must not change.
6. **Exports stay branded.** Match Sheet PDFs must keep branded header, camera card structure, delta/adjustment emphasis, and professional print readability.
7. **Text/card sizing rules.** Paths truncate with ellipsis on one line. Buttons never wrap. Camera cards never overflow their container.
8. **No breaking changes.** Match Lab must always support BRAW, MP4, MOV, cached runs, and export.

## Release & Distribution

### Versioning — bump all three files in sync before any release build

- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `"version"`

### Direct Distribution (macOS DMG)

One command from the project root — handles build, DMG creation, signing, notarization, stapling, and file delivery:

```bash
bash scripts/production/deploy_direct_macos.sh
```

What it does:

1. `npm run build:direct` — builds with `direct-dist` feature + Developer ID signing
2. Creates DMG via bundled `bundle_dmg.sh` (sandbox-safe, works in any terminal)
3. Signs the DMG with Developer ID
4. Notarizes via `notarytool` using the `cineflow-notary` keychain profile
5. Staples and validates
6. Copies to `builds/direct_distribution/macos/CineFlow Suite_<version>_aarch64.dmg`
7. Copies to `web_three/licensing-server/releases/actual/CineFlow.dmg` (the live download endpoint)

After the script: `cd /Users/alan/_localDEV/web_three && git push`, then on the server `sudo docker compose down && sudo docker compose up -d`.

Signing identity: `Developer ID Application: Nudson Alan Terrinha Alves (RD7UU4Z3D2)`
Keychain profile: `cineflow-notary` (apple-id: `alan.creative@icloud.com`, team: `RD7UU4Z3D2`)

### Mac App Store (.pkg)

```bash
npx tauri build   # builds the .app, signed with 3rd Party Mac Developer Application cert
bash scripts/production/mac_sign_and_package.sh   # re-signs + packages → .pkg
```

Then open Transporter, drop the `.pkg`, and deliver. Finished builds go to `builds/app_stores/macos_app_store/`.

The App Store build uses `entitlements.app.plist` (full sandbox). Nested executables (ffmpeg, ffprobe, braw_bridge) must be signed with `entitlements.child.plist` (`app-sandbox=true` + `inherit=true`) before the main `.app` is signed — Transporter rejects them otherwise.

Provisioning profile must be installed via Xcode (right-click → Open With → Xcode), not System Settings.

### Build output folders

| Distribution | Local archive | Live endpoint |
| --- | --- | --- |
| Direct DMG | `builds/direct_distribution/macos/` | `web_three/licensing-server/releases/actual/CineFlow.dmg` |
| App Store pkg | `builds/app_stores/macos_app_store/` | Transporter → App Store Connect |
## Cross-Platform Rules (macOS ↔ Windows)

This repo ships on **both macOS and Windows**. Changes made on one side must not break the other. The rules below come from real regressions caught during Windows builds — treat them as hard constraints, not suggestions.

### tauri.conf.json — never touch these two fields

```json
"targets": "all"                      // NEVER change to ["app","dmg"] or any OS-specific list
"beforeBuildCommand": "npm run build" // NEVER set to "" — Windows CI needs the frontend built
```

Setting `targets` to a macOS-specific list (`["app","dmg"]`) makes it impossible to produce a Windows installer. Tauri picks the right targets per OS automatically when set to `"all"`.

### Cargo.toml — release profile constraints

```toml
[profile.release]
panic = "unwind"   # NOT "abort" — needed for WinDbg crash dump analysis on Windows
# strip must NOT be set — on MSVC, debug symbols live in a separate .pdb file.
# Stripping the binary doesn't remove the .pdb but was explicitly avoided to keep
# crash dump analysis working. Do not add strip = true/symbols/debuginfo.
```

`opt-level`, `lto`, and `codegen-units` are safe to tune. `panic` and `strip` are not.

### license.rs — LicenseStatus struct rule

When adding a field to `LicenseStatus`, you **must** initialize it in every single return site across all `cfg` branches — including the success path of `activate_license`. The compiler only catches this when building with `--features direct-dist`, which is a Windows-only build step and will not surface during a macOS-only workflow.

Always verify both builds compile before pushing:

```bash
cargo check --manifest-path src-tauri/Cargo.toml                          # base build
cargo check --manifest-path src-tauri/Cargo.toml --features direct-dist   # direct-dist build
```

### macOS-only resources (libs/, Frameworks/)

`src-tauri/libs/` and `src-tauri/Frameworks/` contain macOS dylibs and frameworks. They are referenced in `tauri.conf.json` resources and the macOS `frameworks` array. Do not add them to any Windows-facing config key. The MSI bundler (WiX `light.exe`) will fail if it tries to harvest those paths as Windows resources.

### Two bundle identifiers — never merge them

- App Store build: `com.exposeu.cineflow` — uses `entitlements.app.plist`
- Direct distribution build: `com.exposeu.cineflow-direct` — uses `entitlements.direct.plist` + `tauri.direct.conf.json`

`build:direct` passes `--config src-tauri/tauri.direct.conf.json` which overrides the identifier at build time. This prevents sandbox container conflicts when both builds are installed on the same machine. Never change `tauri.conf.json`'s identifier to the `-direct` variant — that file is shared by all builds.

### Build targets reference

| Purpose | Command | Installer |
| --- | --- | --- |
| Direct distribution (with trial + licensing) | `npm run build:direct` | NSIS `.exe` |
| Windows Store | `npm run tauri -- build --bundles msi` | MSI |
| macOS App Store | `npm run tauri -- build --bundles app,dmg` | `.app` / `.dmg` |

When building `build:direct` on Windows, always pass `--bundles nsis` explicitly to avoid the MSI bundler running in parallel and failing on the macOS `libs/` resources:

```bash
npm run tauri -- build --features direct-dist --bundles nsis
```

## Key Docs

- `docs/DEVELOPER_ONBOARDING.md` — quick-start and workspace overview
- `docs/APP_ARCHITECTURE.md` — Camera Match Lab, BRAW pipeline, frame sampling, design system details
- `docs/PHASES.md` — feature roadmap
