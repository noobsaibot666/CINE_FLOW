# Review Core Phase 4.x Premium Review Report

## Summary
- Hardened Review Core share downloads so shared exports return only proxy media and surface a distinct `PROXY_NOT_READY` error state.
- Upgraded the internal Share panel to support compact multi-version selection across the full active Review Core project, with search and bulk-select over filtered results.
- Refined timeline comment markers and reviewer identity presentation so comments, markers, and reviewer badges are visually linked by deterministic author color.
- Re-checked project scoping so Review Core standalone projects remain isolated and share mode stays constrained to the share link scope.

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
    - continues to enforce share token/session rules
    - now returns `PROXY_NOT_READY` when the proxy output is missing or not ready

## UX Notes
- Share download CTA now reads `Download Proxy`.
- Internal share toggle now reads `Allow proxy download`.
- Share version picker is project-scoped and no longer depends on the currently selected asset in the player.
- Share selection supports:
  - filename search
  - grouped assets with version counts
  - `Select all filtered`
  - `Clear`
- Timeline markers now:
  - use deterministic reviewer colors
  - show author-aware tooltips
  - distinguish resolved comments with a muted outlined treatment
- Reviewer identity now appears as:
  - a compact initial badge
  - consistent author color on chips, names, and timeline markers

## Project Isolation Notes
- Review Core standalone project picker remains independent of `Open Workspace / Review`.
- Internal Review Core asset lists still resolve through the active Review Core `project_id`.
- Shared Review surfaces continue to resolve assets and versions through the share link token scope and do not expose internal project libraries.

## Manual Test Checklist
1. Open `Media Workspace -> Review Core`.
2. Create or open a standalone Review Core project.
3. Import at least two assets with multiple versions in the same Review Core project.
4. Open the Share panel and confirm assets from only the active Review Core project appear.
5. Filter the share list by filename and use `Select all filtered`.
6. Create a share link containing versions from multiple assets.
7. Open the share route and confirm only shared assets and versions are visible.
8. Add comments from two different reviewer names and confirm reviewer badges/colors are consistent in chips, comment rows, and timeline markers.
9. Hover timeline markers and confirm tooltip format shows timecode plus author and truncated comment text.
10. Click a timeline marker and confirm playback seeks and the matching comment row highlights briefly.
11. Resolve a comment internally and confirm its marker switches to the muted outlined state.
12. Trigger a shared download before proxy creation is ready and confirm the UI message reads `Proxy not ready yet.`
13. Download a completed shared file and confirm the saved file is a proxy MP4, not the original source asset.

## Validation
1. `npm run build`
2. `cargo check`
3. `cargo test`

All three passed.
