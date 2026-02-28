# Review Core Phase 2 Report

## Schema Changes
- Added `review_core_comments` table with version-scoped comments.
- Columns:
  - `id TEXT PRIMARY KEY`
  - `asset_version_id TEXT NOT NULL`
  - `timestamp_ms INTEGER NOT NULL`
  - `frame_number INTEGER`
  - `text TEXT NOT NULL`
  - `author_name TEXT NOT NULL DEFAULT 'Anonymous'`
  - `resolved INTEGER NOT NULL DEFAULT 0`
  - `created_at TEXT NOT NULL`
- Indexes:
  - `idx_comments_asset_version_time`
  - `idx_comments_asset_version_created`

## Commands Added
- `review_core_add_comment(asset_version_id, timestamp_ms, frame_number?, text, author_name?)`
- `review_core_list_comments(asset_version_id)`
- `review_core_update_comment(comment_id, updates)`
- `review_core_delete_comment(comment_id)`

## UI Notes
- Added a Review Core comments panel below the player.
- Added a composer with:
  - current timecode display
  - author input
  - textarea
  - `Add` button
  - `Cmd/Ctrl + Enter` submit shortcut
- Added version-scoped comment rows with:
  - timecode
  - optional frame number for CFR clips
  - resolved toggle
  - delete action with confirm
  - disabled `Annotate` placeholder button for Phase 3
- Clicking a comment seeks the player and briefly highlights the row.
- If the player is not ready yet, the seek is queued and applied on `canplay`.

## Manual Test Steps
1. Import a file in `Media Workspace -> Review Core`.
2. Wait for processing to reach `ready`.
3. Start playback, pause, and add a comment.
4. Confirm the comment appears at the expected timecode.
5. Reload the app and confirm the comment persists.
6. Click the comment and confirm playback seeks and the row highlights briefly.
7. Toggle resolved on and off; reload and confirm the state persists.
8. Create a new version of the same asset and confirm comments are isolated per version.
9. Delete a comment and confirm it stays deleted after reload.

## Validation
- `cargo check` — PASS
- `cargo test` — PASS
- `npm run build` — PASS

## Known Limitations
- Comments are strictly local and author names are free text only.
- CFR frame numbers are derived from stored fps metadata and are deterministic, but still metadata-dependent.
- VFR comments store only timestamp-based anchors and display `HH:MM:SS.mmm`.
- Editing comment text in-place is supported at the backend command level but not yet exposed in the Phase 2 UI.
