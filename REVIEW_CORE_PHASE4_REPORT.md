# Review Core Phase 4 Report

## Schema
- Added `review_core_share_links`.
- Columns:
  - `id TEXT PRIMARY KEY`
  - `project_id TEXT NOT NULL`
  - `token TEXT NOT NULL UNIQUE`
  - `asset_version_ids_json TEXT NOT NULL`
  - `expires_at TEXT NULL`
  - `password_hash TEXT NULL`
  - `allow_comments INTEGER NOT NULL DEFAULT 1`
  - `allow_download INTEGER NOT NULL DEFAULT 0`
  - `created_at TEXT NOT NULL`
- Indexes:
  - `idx_share_links_project_id`
  - `idx_share_links_token`
- Added `review_core_share_sessions`.
- Columns:
  - `id TEXT PRIMARY KEY`
  - `share_link_id TEXT NOT NULL`
  - `token TEXT NOT NULL UNIQUE`
  - `expires_at TEXT NOT NULL`
  - `created_at TEXT NOT NULL`
  - `last_seen_at TEXT NULL`
- Indexes:
  - `idx_share_sessions_share_link_id`
  - `idx_share_sessions_token`

## Commands
- Link management:
  - `review_core_create_share_link`
  - `review_core_list_share_links`
  - `review_core_revoke_share_link`
- Link resolution:
  - `review_core_resolve_share_link`
  - `review_core_verify_share_link_password`
  - `review_core_share_unlock`
- Token-scoped access:
  - `review_core_share_list_assets`
  - `review_core_share_list_versions`
  - `review_core_share_list_thumbnails`
  - `review_core_share_list_comments`
  - `review_core_share_add_comment`
  - `review_core_share_list_annotations`
  - `review_core_share_export_download`

## Route Behavior
- Canonical share route is hash-based:
  - `/#/r/{token}`
- The app shell detects that route and renders a restricted Review Core surface only.
- Restricted surface does not render Modules/Home navigation or other app domains.
- Share-mode media URLs append `?t={token}` so the embedded Axum server can enforce:
  - token exists
  - token is not expired
  - requested `asset_version_id` is included in the share link scope
- For password-protected links, media URLs must also include `?s={session_token}`.
- The embedded Axum server now enforces:
  - protected links without a valid session return `403`
  - expired links return `410`
  - sessions are renewed with a 30-minute sliding window on each valid request
- HLS playlists are rewritten on the server so segment URIs inherit `t` and `s`.
- Internal Review Core requests continue to work without a token.

## Share Surface
- Included:
  - asset list
  - scoped version selector
  - player
  - thumbnail strip
  - annotations view overlay
  - comments panel only when `allow_comments` is enabled
  - download button only when `allow_download` is enabled
- Password-protected links show an in-memory unlock gate before loading the shared review surface.
- Password unlock now mints a short-lived server-side session token stored in SQLite.
- Internal Review Core now includes a Share panel with:
  - version selection
  - allow comments toggle
  - allow download toggle
  - optional expiry
  - optional password
  - copy link
  - revoke link

## Dependencies Added
- `bcrypt`
  - required for optional password-protected links without external auth
- `rand`
  - required for secure 32-byte token generation

## Manual Test Checklist
1. Open `Media Workspace -> Review Core`.
2. Create a share link for one version with no password and no expiry.
3. Open `/#/r/{token}`.
4. Confirm only included versions are visible.
5. Confirm playback, thumbnails, and seek all work.
6. If comments are enabled, add a comment and confirm it persists after reload.
7. Confirm annotations render in view mode near the related comment time.
8. Create an expired share link and confirm the share route shows an expired/unavailable state.
9. Create a password-protected share link.
10. Confirm direct protected media URLs without `s` return `403`.
11. Confirm wrong password fails and correct password unlocks the review.
12. Reload the share page and confirm password must be re-entered.
13. Create links with and without download permission and confirm the download button appears only when allowed.
14. Revoke a link and confirm the route stops resolving immediately.

## Known Limitations
- Session tokens are kept in memory on the share route and are intentionally not persisted across reloads.
- Downloads currently export the stored original file for the selected shared version.
- Share links are local-first hash routes inside the current app shell; they are not internet-hosted review URLs.
