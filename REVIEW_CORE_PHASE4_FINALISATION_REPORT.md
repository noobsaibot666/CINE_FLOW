# Review Core Phase 4 Finalisation Report

## Summary
- Finalised the Frame.io-like Review Core surface with comment-linked timeline markers, deterministic reviewer identity styling, compact multi-version share selection, and proxy-only shared downloads.
- Tightened the internal/share boundary so the Review Core library remains project-scoped and share-mode continues to resolve only versions contained in the active share token scope.
- Preserved the existing share security model:
  - `t` token enforcement
  - `s` session enforcement for protected links
  - playlist query propagation during HLS rewrite

## Audit
Before changes, the Review Core timeline UI was already built inside the player card in `ReviewCore.tsx`, and comments already supported seek-on-click through `seekToComment()`. Share creation UI also already existed there, but the version picker was effectively tied to the currently selected asset because the selectable version list came from the player’s `versions` state rather than the whole active Review Core project. Shared download behavior in `review_core_share_export_download` was already copying `proxy_mp4_key`, not the original source file, but the UI still labeled it as an original download and did not surface a clean typed `PROXY_NOT_READY` state. Review Core project picking and active library scoping were already split from share mode, with standalone Review Core project state restored from `review_core:last_project_id` and internal asset listing filtered by active `project_id`.

## Files Changed
- `src/components/ReviewCore.tsx`
- `src/index.css`
- `src/types.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`

## Commands Added/Modified
- Added:
  - `review_core_list_assets_with_versions(project_id)`
- Modified:
  - `review_core_share_export_download`
    - continues to validate share scope, expiry, permission, and session requirements
    - returns proxy media only
    - returns `PROXY_NOT_READY` when proxy output is missing

## UI Notes
- Timeline markers are now comment-linked and playhead-aware:
  - positioned from `timestamp_ms / duration`
  - clickable to seek
  - tooltip shows `timecode — author — snippet`
  - resolved markers render muted/outlined instead of disappearing
- Reviewer identity is now deterministic per `author_name`:
  - stable dark-safe color from a fixed non-purple palette
  - 1–2 letter badge
  - shared across timeline markers, reviewer summary chips, and comment author rows
- Reviewers summary is compact and capped:
  - shows up to 5 reviewer chips
  - overflow becomes `+N`
- Internal share selection is now project-wide:
  - asset filename search
  - grouped asset sections
  - per-version checkboxes
  - `All` and `Clear` controls
- Shared download UI is now explicitly proxy-only:
  - button label: `Download Proxy`
  - permission toggle label: `Allow proxy download`
  - clean proxy-missing message: `Proxy not ready yet.`

## Manual Checklist
1. Open `Media Workspace -> Review Core`.
2. Create or open a standalone Review Core project.
3. Import at least two assets under the same Review Core project and create multiple versions where possible.
4. Confirm the Library only shows assets from the active Review Core project.
5. Select an asset and confirm comments still seek correctly from comment rows.
6. Add comments from multiple author names and confirm author badges/colors stay stable across reload within the same local data.
7. Play media and confirm the matching timeline marker and comment row highlight when the playhead passes a comment timestamp.
8. Hover a timeline marker and confirm the tooltip shows timecode, author, and a truncated snippet.
9. Resolve a comment and confirm the marker remains visible but switches to the muted/outlined state.
10. Open the Share panel and confirm asset search filters by filename.
11. Use `All` and `Clear` and confirm version checkbox state updates across filtered assets.
12. Create a share link containing versions from multiple assets and confirm only selected versions are visible from the share route.
13. For a password-protected share link, confirm media URLs still require a valid `s` session token.
14. Attempt a shared download before proxy generation completes and confirm the UI shows `Proxy not ready yet.`
15. Download from a ready shared version and confirm the exported file is the proxy MP4, not the original source media.

## Notes
- No manual UI tests were run in this pass.
- No build or cargo commands were run in this pass.
