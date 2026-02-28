# Review Core Phase 1 Report

## Summary
- Added a new Media Workspace app: `Review Core`.
- Implemented local-first ingest into app-managed storage under macOS Application Support.
- Added SQLite primitives for assets and asset versions.
- Added Review Core processing jobs using the existing `JobManager`.
- Added an embedded Axum media server for local HLS, poster, and thumbnail delivery.

## DB Schema

### `assets`
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL`
- `filename TEXT NOT NULL`
- `original_path TEXT NOT NULL`
- `storage_key TEXT NOT NULL`
- `file_size INTEGER NOT NULL`
- `duration_ms INTEGER`
- `frame_rate REAL`
- `width INTEGER`
- `height INTEGER`
- `codec TEXT`
- `status TEXT NOT NULL`
- `checksum_sha256 TEXT NOT NULL`
- `created_at TEXT NOT NULL`

### `asset_versions`
- `id TEXT PRIMARY KEY`
- `asset_id TEXT NOT NULL`
- `version_number INTEGER NOT NULL`
- `original_file_key TEXT NOT NULL`
- `proxy_playlist_key TEXT`
- `thumbnails_key TEXT`
- `poster_key TEXT`
- `processing_status TEXT NOT NULL`
- `created_at TEXT NOT NULL`

### Indexes
- `idx_asset_versions_asset_version` unique on `(asset_id, version_number)`
- `idx_assets_project_id` on `assets(project_id)`
- `idx_asset_versions_asset_id` on `asset_versions(asset_id)`

## Commands Added
- `review_core_ingest_files(project_id, file_paths)`
- `review_core_list_assets(project_id)`
- `review_core_list_asset_versions(asset_id)`
- `review_core_get_server_base_url()`

## Storage Paths
- Base dir:
  - `~/Library/Application Support/wrap-preview/review_core/`
- Originals:
  - `originals/<project_id>/<asset_id>/v<version_number>/original.<ext>`
- Derived:
  - `derived/<project_id>/<asset_id>/v<version_number>/hls/index.m3u8`
  - `derived/<project_id>/<asset_id>/v<version_number>/hls/segment_0001.ts`
  - `derived/<project_id>/<asset_id>/v<version_number>/thumbs/thumb_0001.jpg`
  - `derived/<project_id>/<asset_id>/v<version_number>/poster.jpg`

## ffmpeg / ffprobe Flow

### Probe
- Existing backend `ffprobe::probe_file()` is used to extract:
  - duration
  - resolution
  - frame rate
  - codec

### HLS
```bash
ffmpeg -y -i <input> \
  -vf scale='min(1280,iw)':-2 \
  -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  [-c:a aac -b:a 128k | -an] \
  -f hls -hls_time 2 -hls_playlist_type vod \
  -hls_segment_filename <derived>/hls/segment_%04d.ts \
  <derived>/hls/index.m3u8
```

### Poster
```bash
ffmpeg -y -ss 00:00:01.000 -i <input> -frames:v 1 -q:v 2 <derived>/poster.jpg
```

### Thumbnails
```bash
ffmpeg -y -i <input> -vf fps=1/<interval_seconds> -frames:v 10 -q:v 4 <derived>/thumbs/thumb_%04d.jpg
```

## Local Media Server
- Starts on app boot with dynamic localhost port.
- Base URL is exposed via `review_core_get_server_base_url()`.
- Routes:
  - `/media/{project_id}/{asset_id}/{version_id}/hls/{file..}`
  - `/media/{project_id}/{asset_id}/{version_id}/thumbs/{file}`
  - `/media/{project_id}/{asset_id}/{version_id}/poster.jpg`
- Path traversal is rejected before filesystem access.

## Frontend Surface
- New launcher card in Media Workspace: `Review Core`
- Disabled until a workspace project exists
- View includes:
  - asset list
  - status chip
  - version dropdown
  - HLS player
  - deterministic time display `HH:MM:SS:FF`
  - metadata panel

## Dependencies Added
- Rust:
  - `axum`
  - Reason: required for the embedded localhost media server specified for Review Core
- Frontend:
  - `hls.js`
  - Reason: required for explicit HLS playback support in the React Review Core player

## Validation
- `npm run build` — PASS
- `cargo check` — PASS
- `cargo test` — PASS

## Added Tests
- Storage path determinism/scoping:
  - `review_core::storage::tests::storage_paths_are_deterministic_and_scoped`
- Path traversal reject:
  - `review_core::server::tests::traversal_is_rejected`

## How To Test With A Real File
1. Open Wrap Preview.
2. Load a post-production workspace in `Open Workspace / Review`.
3. Return to `Media Workspace`.
4. Open `Review Core`.
5. Click `Import Files` and choose one or more local media files.
6. Open the Jobs HUD and confirm `review_core_process_version` jobs move from queued/running to done or failed.
7. Wait for the asset status to become `ready`.
8. Select the asset and confirm:
   - poster appears before playback
   - HLS playback starts
   - metadata values populate
   - time display updates deterministically

## Known Limitations
- Phase 1 creates only version `1`; new manual re-versions are not exposed yet.
- Processing failures currently mark asset/version as `failed` without a persisted error column in the Review Core tables.
- Thumbnail strip rendering is not surfaced yet; poster-first playback is the current Phase 1 UI.
- HLS output uses a single proxy rendition only; no adaptive ladder is generated in this phase.
