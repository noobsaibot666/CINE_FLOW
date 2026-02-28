# Review Core Phase 4 Certification

## Summary
- Phase 4 Share Links is certified against the Option A report with one patch applied during this audit.
- Patch applied:
  - Share-route thumbnail URLs now include `s={session_token}` for password-protected links.
  - Added a playlist rewrite test to prove `t` and `s` propagation into HLS segment URLs.

## PASS / FAIL Matrix

### A) Schema
- `[PASS]` `review_core_share_links` exists with all required columns and indexes.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/db.rs`
    - `Database::new()` migration batch
    - `Database::create_tables()`
    - table definition at `CREATE TABLE IF NOT EXISTS review_core_share_links`
    - indexes `idx_share_links_project_id`, `idx_share_links_token`

- `[PASS]` `review_core_share_sessions` exists with all required columns and indexes.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/db.rs`
    - `Database::new()` migration batch
    - `Database::create_tables()`
    - table definition at `CREATE TABLE IF NOT EXISTS review_core_share_sessions`
    - indexes `idx_share_sessions_share_link_id`, `idx_share_sessions_token`

### B) Commands
- `[PASS]` `review_core_create_share_link` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_list_share_links` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_revoke_share_link` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_resolve_share_link` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_verify_share_link_password` exists and is registered.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
  - Note:
    - Frontend currently uses `review_core_share_unlock` for the production unlock path, which is the correct hardened flow.

- `[PASS]` `review_core_share_unlock` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_list_assets` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_list_versions` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_list_thumbnails` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_list_comments` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_add_comment` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_list_annotations` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

- `[PASS]` `review_core_share_export_download` exists, is registered, and is used from frontend.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/lib.rs`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`

### C) Route behavior (Share Mode)
- `[PASS]` `/#/r/{token}` renders a restricted surface only.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/App.tsx`
    - `shareRouteToken` hash parsing
    - conditional branch rendering `ReviewCore` with `shareToken`
  - Result:
    - Normal Modules/Home navigation and other app domains are bypassed when hash route is active.

- `[PASS]` Share-mode media requests include `?t={token}`.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`
    - `playlistUrl`, `posterUrl`, and thumbnail URL builders

- `[PASS]` Password links require `?s={session_token}` for protected media requests.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`
    - `shareSessionToken` state
    - playlist/poster/thumb query construction
    - `review_core_share_export_download` call includes `sessionToken`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs`
    - `validate_share_session()`

- `[PASS]` Axum media server enforces:
  - missing/invalid `t` for share-scoped access -> `403`
  - expired link -> `410`
  - password-protected link without valid `s` -> `403`
  - scope violation -> `403`
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs`
    - `authorize_share_access()`
    - `map_share_error()`
    - tests:
      - `password_protected_link_requires_session`
      - `share_scope_enforcement_rejects_other_versions`
      - `expired_session_is_rejected_and_valid_session_slides`

- `[PASS]` Sessions are minted only via `review_core_share_unlock`, stored in SQLite, expire at 30 minutes, and renew on valid requests.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `review_core_share_unlock()`
    - `generate_share_token()`
    - `validate_share_session()`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/db.rs`
    - `create_review_core_share_session()`
    - `get_review_core_share_session_by_token()`
    - `touch_review_core_share_session()`

- `[PASS]` HLS playlists are rewritten so segment URIs include required query params `t` and `s`.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs`
    - `build_binary_response()`
    - `rewrite_playlist()`
    - test `playlist_rewrite_propagates_share_query_params`

- `[PASS]` Protected HLS playback has code-path evidence for segment fetch propagation.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`
    - HLS loads playlist URL with `t` and `s`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs`
    - rewritten playlist emits segment URLs carrying same query params
  - Note:
    - This certification is based on code-path and test evidence; no manual desktop playback run was performed in this terminal-only audit.

### D) UI behavior
- `[PASS]` Share link creation panel exists in internal Review Core.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`
    - internal Share panel with version selection, toggles, expiry, password, copy, revoke

- `[PASS]` Share page password gate fails on wrong password, unlocks on correct password, and reload requires password again.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`
    - password gate uses `review_core_share_unlock`
    - `shareSessionToken` stored in component memory only
    - route resolve effect clears session state on reload/re-entry

### E) Revoke behavior
- `[PASS]` Revoking a link immediately blocks access and removes sessions for that link.
  - Evidence:
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/db.rs`
    - `delete_review_core_share_link()` deletes `review_core_share_sessions` first, then share link row
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/commands.rs`
    - `review_core_revoke_share_link()`
    - `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs`
    - `resolve_share_link()` + `validate_share_session()` reject missing/revoked records immediately

## Files Changed During Certification
- `/Users/alan/_localDEV/exposeu_wrapkit/src/components/ReviewCore.tsx`
  - Fixed restricted-share thumbnail URLs to append `s={session_token}` when present.
- `/Users/alan/_localDEV/exposeu_wrapkit/src-tauri/src/review_core/server.rs`
  - Added a unit test for HLS playlist query propagation.

## Validation Results
- `cargo test` — PASS
- `cargo check` — PASS
- `npm run build` — PASS

## Validation Output Summary
- `cargo test`
  - `16` tests passed
  - includes:
    - `password_protected_link_requires_session`
    - `share_scope_enforcement_rejects_other_versions`
    - `expired_session_is_rejected_and_valid_session_slides`
    - `playlist_rewrite_propagates_share_query_params`
- `cargo check`
  - PASS
- `npm run build`
  - PASS
