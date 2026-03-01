# Review Core Frame Notes Finalisation

## What changed
- Fixed onion-skin alignment by separating the video stage from the timeline rail and calculating the overlay rect from the actual video stage instead of the larger player container.
- Kept onion-skin opacity changes as pure opacity updates, with no playhead reset when toggling the overlay.
- Hardened `review_core_extract_frame` so frame capture clamps safely near clip end, rejects missing sources early, preserves deterministic JPG output, and reports clearer capture failures through the existing job flow.
- Kept Frame Notes library fully project-scoped via the existing `review_core_list_frame_notes(project_id)` path and clarified version context in the grouped UI.
- Preserved flattened JPG export for `annotated.jpg` beside `frame.jpg`, using the existing canvas render plus `save_image_data_url`.
- Tightened Frame Notes UI layout so toolbar and note actions wrap cleanly instead of overflowing.

## Files touched
- `src/components/ReviewCore.tsx`
- `src/index.css`
- `src-tauri/src/commands.rs`

## Manual checklist
1. Open Review Core and select a processed asset version.
2. Pause on a visible frame and click `Grab Frame`.
3. Confirm a new Frame Note appears under the correct asset filename and version group.
4. Draw markup on the still, save it, then export `annotated.jpg`.
5. Confirm `annotated.jpg` is written beside `frame.jpg` in the Frame Note folder.
6. Switch to another version of the same asset, select the note, enable `Onion Skin`, and confirm the overlay matches the visible video image area without drifting into letterbox space.
7. Resize the window and confirm onion skin remains aligned.
8. Toggle onion skin on and off and confirm playback position does not jump.
9. Hide the note and confirm it no longer renders as an onion-skin overlay.
10. Switch Review Core projects and confirm the Frame Notes library updates to the active project only.

## Known limitations
- Onion skin assumes notes are compared against another version of the same asset at the same timestamp; it does not perform retiming across editorial changes.
- Frame capture prioritizes correctness over speed, so extraction may be slower on large originals when no proxy MP4 is available.
