# Review Core Phase 3 Report

## Schema Changes
- Added `review_core_annotations` for comment-linked visual markup.
- Columns:
  - `id TEXT PRIMARY KEY`
  - `comment_id TEXT NOT NULL`
  - `asset_version_id TEXT NOT NULL`
  - `timestamp_ms INTEGER NOT NULL`
  - `vector_data TEXT NOT NULL`
  - `coordinate_space TEXT NOT NULL DEFAULT 'normalized_0_1'`
  - `created_at TEXT NOT NULL`
- Indexes:
  - `idx_annotations_comment`
  - `idx_annotations_asset_version_time`
- Added `review_core_approval_state` for version-level approval.
- Columns:
  - `asset_version_id TEXT PRIMARY KEY`
  - `status TEXT NOT NULL`
  - `approved_at TEXT NULL`
  - `approved_by TEXT NULL`

## Commands Added
- `review_core_add_annotation(comment_id, vector_data_json)`
- `review_core_list_annotations(asset_version_id)`
- `review_core_delete_annotation(annotation_id)`
- `review_core_get_approval(asset_version_id)`
- `review_core_set_approval(asset_version_id, status, approved_by?)`

## UI Notes
- Review Core now includes compact version-scoped approval controls beside the version selector.
- Comment rows now support inline text editing with `Save` / `Cancel`.
- The `Annotate` action opens an overlay aligned to the visible video frame, not the full letterboxed container.
- Tools included in Phase 3:
  - Pointer/select and drag
  - Pen
  - Arrow
  - Rectangle
  - Circle
  - Text label
- Saved annotations are shown automatically in view mode when playback is within `±250ms` of the linked comment timestamp.
- Comment rows show an `Annotated` badge when stored vector data exists.

## Manual Test Checklist
1. Import a file in `Media Workspace -> Review Core`.
2. Wait for processing to reach `ready`.
3. Start playback, pause at time `T`, and add a comment.
4. Click `Annotate`, draw an arrow and a pen stroke, then click `Save`.
5. Reload the app and confirm the annotation persists.
6. Click the comment and confirm:
   - playback seeks to the stored timestamp
   - the row highlights briefly
   - the annotation overlay appears in view mode
7. Confirm the annotation is visually aligned to the video image area and not shifted into the letterbox margins.
8. Click `Edit` on the comment, change the text, save, reload, and confirm persistence.
9. Create or ingest version `2` of the same asset and confirm:
   - approval state is independent
   - comments are isolated to that version
   - annotations are isolated to that version
10. Set approval to `Approved` with a name and confirm `approved_at` and `approved_by` persist after reload.

## Validation
- `cargo check` — PASS
- `cargo test` — PASS
- `npm run build` — PASS

## Known Limitations
- Phase 3 stores a single current annotation payload per comment by replacing any previous payload for that comment.
- Pointer/select supports moving whole shapes and deleting the selected shape, but does not yet expose per-vertex editing.
- Text annotations are single-line and use the current text-tool input value.
- Overlay visibility during playback uses timestamp proximity (`±250ms`) rather than frame-accurate event tracks.
