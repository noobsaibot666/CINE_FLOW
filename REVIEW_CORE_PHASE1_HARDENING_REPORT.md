# Review Core Phase 1 Hardening Report

## What Changed
- Added `last_error` persistence to both `assets` and `asset_versions`.
- Added duplicate detection by `(project_id, checksum_sha256)` with a frontend prompt and a default `new_version` ingest policy.
- Stored additional frame-rate probe fields to improve Review Core time display:
  - `avg_frame_rate`
  - `r_frame_rate`
  - `is_vfr`
- Replaced hardcoded HLS GOP values with a computed 2-second GOP derived from fps.
- Hardened the embedded media server with explicit cache headers while keeping it bound to `127.0.0.1`.
- Added Review Core thumbnail listing plus a horizontal thumbnail strip UI with seek-on-click.

## Files Touched
- [src-tauri/src/ffprobe.rs](/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/ffprobe.rs)
- [src-tauri/src/db.rs](/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/db.rs)
- [src-tauri/src/commands.rs](/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs)
- [src-tauri/src/lib.rs](/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs)
- [src-tauri/src/review_core/processor.rs](/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/processor.rs)
- [src-tauri/src/review_core/server.rs](/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs)
- [src/components/ReviewCore.tsx](/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx)
- [src/index.css](/Users/alan/_localDEV/exposeu_wrapkit/src/index.css)
- [src/types.ts](/Users/alan/_localDEV/exposeu_wrapkit/src/types.ts)

## How To Test
1. Open a post-production workspace in `Open Workspace / Review`.
2. Open `Media Workspace -> Review Core`.
3. Import a media file that has never been ingested before.
4. Confirm the asset enters `processing`, the `review_core_process_version` job appears in Jobs HUD, and then resolves to `ready`.
5. Confirm the player shows:
   - poster before playback
   - HLS playback
   - metadata
   - time display
   - thumbnail strip
6. Click multiple thumbnails and confirm the video seeks approximately to those positions.
7. Re-import the same file.
8. Confirm the duplicate dialog appears with:
   - `Create new version under existing asset`
   - `Import as new asset anyway`
9. Choose `Create new version under existing asset` and confirm no duplicate asset is created.
10. Force a processing failure with an invalid or unsupported file and confirm the Review Core UI shows the expandable `Processing error` section.
11. Open network inspector or use browser devtools in the webview and confirm:
   - playlist responses use `Cache-Control: no-cache`
   - poster/thumb responses use long-lived immutable caching

## Validation
- `npm run build` — PASS
- `cargo check` — PASS
- `cargo test` — PASS

## Known Limitations
- Duplicate choice is currently applied to the selected import batch, not per-file granular overrides.
- VFR display falls back to `HH:MM:SS.mmm`; frame values are intentionally not shown as authoritative for VFR clips.
- Thumbnail seek positions are approximate and derived from clip duration and generated thumbnail count.
- Processing errors are stored compactly for UI/debug readability; full ffmpeg stderr is not yet persisted as a separate diagnostics artifact.
