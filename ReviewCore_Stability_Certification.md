# Review Core Stability Certification

## What changed
- Added dev-only Review Core media attach diagnostics prefixed with `[Wrap Preview][ReviewCore]` for version selection and finalization probes.
- Logged missing derived media inputs during probing, including `poster.jpg`, `index.m3u8`, and thumbnail-list readiness.
- Added a single automatic attach refresh after a version transitions to `ready`, plus a dev-only `Retry media attach` action to rerun the probe on demand without continuous request spam.
- Hardened Folder Creator schema import and backend writes to reject absolute paths, traversal segments, excessive depth, and excessive node counts before ZIP export or create-on-disk runs.
- Added a targeted backend test covering protected share access so password-protected download paths still require a valid session token.

## Files touched
- `src/components/ReviewCore.tsx`
- `src/components/FolderCreator.tsx`
- `src/index.css`
- `src-tauri/src/folders.rs`
- `src-tauri/src/commands.rs`

## How to test quickly
1. Open Review Core in a dev build, select a processing version, and confirm the console shows `[Wrap Preview][ReviewCore] media selection` with IDs and URL bases.
2. Let a version transition from `processing` to `ready` and confirm media attaches cleanly; if files are still finalizing, confirm the console logs missing derived files and the dev-only `Retry media attach` action reruns the probe once.
3. Import a malicious Folder Creator JSON using absolute paths, `..`, or a deeply nested tree and confirm the UI shows a clean rejection message.
4. Use Folder Creator `Create on disk` with a valid structure and confirm files are created only inside the chosen destination.
5. Open a password-protected Review Core share link and confirm download remains blocked without a valid unlock session, while a valid unlocked session still permits proxy-only download.

## Validation
- `npm run build`
- `cargo check`

Both passed. No test suite was run in this pass.
