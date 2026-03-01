# Review Core Feedback UX Patch Report

## What changed
- Hardened Review Core media loading so poster, HLS, and thumbnails are gated behind version readiness and a small finalization probe before the player starts requesting derived media.
- Added a shared `buildMediaUrl(...)` path builder in `ReviewCore.tsx` so poster, playlist, and thumbnail URLs use the same identifiers and share-token query handling.
- Reworked internal Review Core review flow around a unified `Feedback` model derived from existing comments and frame notes:
  - `Text` feedback comes from `review_core_comments`
  - `Draw` feedback comes from `review_core_frame_notes`
- Added video-stage controls for `Add Note`, `Mark Frame`, and `Compare`, plus a stable compare opacity control that does not seek or resize the layout.
- Replaced the internal generic thumbnail strip with feedback-frame thumbnails sourced from draw feedback only.
- Replaced the separate stacked comments/frame-notes panels with a single compact feedback list and detail area, while keeping the existing share panel behind a simple tab.
- Added `Projects` back navigation inside the Review Core library when using the standalone Review Core project picker flow.
- Fixed frame-note export tainting by adding a backend `review_core_read_frame_note_image` command and exporting from a backend-provided JPEG data URL instead of drawing HTTP-served images straight into the export canvas.
- Preserved proxy-only share download behavior and the existing share-token/session security model.

## Files touched
- `src/components/ReviewCore.tsx`
- `src/index.css`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`

## How to test
1. Open `Media Workspace -> Review Core`, create or open a Review Core project, and import media.
2. While a version is processing, confirm the player shows `Processing…` with the thin blue loading bar and does not spam poster/HLS/thumb requests.
3. When processing finishes, confirm poster and playback load cleanly and the clip starts without 404 errors.
4. Use `Add Note` from the video stage to create a timecode note, then click its marker in the feedback bar to seek to it.
5. Use `Mark Frame` to capture a frame, add markup, save it, and confirm it appears in the draw-feedback thumbnail strip.
6. Toggle `Compare` with a draw feedback from another version selected and confirm the overlay aligns to the visible video image area without seeking automatically.
7. Export a marked frame and confirm `annotated.jpg` is written beside `frame.jpg` without a `SecurityError`.
8. Click `Projects` in the library header and confirm Review Core returns to the standalone project picker without deleting project data.
9. In share mode, confirm the button still says `Download Proxy` and a missing proxy returns `Proxy not ready yet.`

## Known limitations
- Media finalization retries are capped; if derived files appear after the retry window, reselecting the version or waiting for the next status poll will refresh the player.
- Draw feedback author identity is still derived from frame-note metadata availability; existing frame notes without author data are labeled as draw feedback rather than a named reviewer.
