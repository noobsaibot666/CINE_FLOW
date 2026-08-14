# Release Version Log

Canonical record of what version was actually built/submitted for each channel, so the next
release bumps from a known-correct baseline instead of guessing from `package.json` alone.

**Why `package.json` alone isn't enough:** on 2026-08-14, `mac_sign_and_package.sh` produced a
`1.0.5` `.pkg` and Transporter rejected it — `1.0.5` had already been uploaded to App Store
Connect previously, and Apple's ID-uniqueness check (`ITMS`: *"The provided entity includes an
attribute with a value that has already been used"*) rejects any build whose
`CFBundleShortVersionString`/`CFBundleVersion` isn't strictly higher than **every version ever
accepted for `com.exposeu.cineflow`** — even if that submission was later replaced, withdrawn, or
never actually shipped. The three version files in the repo can be perfectly in sync and still
collide with App Store Connect's own history. **Before bumping, check this log — not just
`package.json` — for the highest version ever actually uploaded, and go one above that.**

## Before every release build

1. Check the table below for the highest version marked `Uploaded` under App Store Connect.
2. Bump `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` to a version
   strictly higher than that (see CLAUDE.md → Versioning — all three must stay synchronized).
3. Build, sign, and package.
4. **Add a row to this log immediately after upload** — before Transporter finishes processing,
   before you know if it passes review. Apple's version-uniqueness check is keyed to what was
   *uploaded*, not what shipped, so a rejected or superseded upload still permanently burns that
   version number.

## Log

| Version | Date       | App Store Connect                              | Direct DMG | Notes |
|---------|------------|-------------------------------------------------|------------|-------|
| 1.0.6   | 2026-08-14 | not yet uploaded                                 | not built  | Bumped after Transporter rejected a `1.0.5` upload for a duplicate version ID. Also includes the Fuji/Nikon OCIO false-trusted-status fix and staging-script hardening. |
| 1.0.5   | 2026-05-18 | uploaded at least once (exact date unknown — predates this log) | built | `.pkg` rebuilt and re-signed on 2026-08-14 for the V1.2 OCIO/RAW gate work, but never re-uploaded — Transporter caught the version collision against the earlier `1.0.5` upload before a second upload happened. |
| 1.0.4   | 2026-05-02 | unknown                                          | unknown    | Direct-distribution bundle-ID split (`com.exposeu.cineflow-direct`) landed same day. |
| 1.0.3   | 2026-05-01 | unknown                                          | unknown    | |
| 1.0.2   | 2026-04-29 | resubmitted after review rejections (commit `1c0dd70`, `30f176a`) | — | `1c0dd70` bumped `Cargo.toml`/`tauri.conf.json` but **not** `package.json` — a real instance of the three-file drift the sync rule exists to prevent. Worth grepping all three before trusting any one of them for historical versions before this log started. |
| 1.0.1   | 2026-04-17 | unknown                                          | unknown    | |
| 1.0.0   | 2026-04-08 | first macOS App Store submission prep (commit `7782f81`) | — | |

Versions before `1.0.0` (`0.1.0`, `1.0.0-beta.*`) predate App Store submission and are omitted.

## Updating this log

Add a row after every `mac_sign_and_package.sh` run whose `.pkg` is actually handed to
Transporter, and after every `deploy_direct_macos.sh` run that reaches the live download
endpoint (`web_three/licensing-server/releases/actual/CineFlow.dmg`). A build that was only
produced locally and never uploaded doesn't need a row — only versions that reached Apple's
servers or the live DMG endpoint can collide with a future release.
