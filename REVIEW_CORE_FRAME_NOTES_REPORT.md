# Review Core Frame Notes Report

## Summary
- Added a new Review Core sub-tool called `Frame Notes` inside the existing Review Core surface.
- Frame Notes are project-scoped and version-scoped:
  - extracted stills are stored under Review Core derived storage
  - note metadata is stored in SQLite
  - notes never mix across Review Core projects
- Users can now:
  - pause on a frame and grab it as a Frame Note
  - draw markup over the captured still
  - save markup back to the note record
  - export a flattened annotated JPG into the note folder
  - toggle note visibility
  - compare older-version notes as onion-skin overlays on the current version

## Files Changed
- `src/components/ReviewCore.tsx`
- `src/index.css`
- `src/types.ts`
- `src-tauri/src/db.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/review_core/server.rs`
- `src-tauri/src/lib.rs`

## Commands Added
- `review_core_extract_frame(asset_version_id, timestamp_ms)`
- `review_core_list_frame_notes(project_id)`
- `review_core_update_frame_note(note_id, updates)`
- `review_core_delete_frame_note(note_id)`

## Commands Reused
- `save_image_data_url(path, data_url)`
  - used by Frame Notes JPG export to save flattened annotated stills into Review Core storage

## Storage Notes
- Added SQLite table:
  - `review_core_frame_notes`
- Captured stills are stored at:
  - `review_core/derived/<project>/<asset>/v<version>/frame_notes/<note_id>/frame.jpg`
- Exported flattened images are stored alongside the captured still as:
  - `annotated.jpg`

## UI Notes
- Frame Notes live inside `ReviewCore.tsx` as a joined section near the player.
- The section includes:
  - global `Show Frame Notes` toggle
  - `Grab Frame` button
  - searchable note library grouped by asset + version
  - per-note hide/show, export, and delete actions
  - still-image markup editor using the existing normalized drawing model
  - onion-skin compare toggle and opacity slider
- Styling remains dark and minimal:
  - no gradients
  - no purple
  - emphasis through type, spacing, and small controls

## Manual Checklist
1. Open `Media Workspace -> Review Core`.
2. Open a Review Core project and select an asset version that is ready for playback.
3. Pause on a frame and click `Grab Frame`.
4. Confirm a new Frame Note appears in the library grouped under the current asset/version.
5. Confirm the still image loads in the Frame Notes detail pane.
6. Draw markup using pen, arrow, rectangle, circle, and text.
7. Change drawing color using the swatches and save the note.
8. Re-open the note and confirm markup persists.
9. Export the note as JPG and confirm `annotated.jpg` is written beside `frame.jpg` in the note folder.
10. Create a note on an older version of the same asset.
11. Switch to a newer version and select the older note.
12. Enable `Onion Skin` and confirm playback seeks to the note timestamp and the still/markup overlays over the current player image.
13. Adjust onion-skin opacity and confirm the overlay updates without layout jumping.
14. Hide a note and confirm it remains in the library with muted presentation and does not render as onion skin while hidden.
15. Delete a note and confirm it disappears from the library.

## Notes
- Existing Review Core ingest, playback, comments, annotations, share links, sessions, and project picker flows were preserved.
- No build or cargo commands were run in this pass.
