# Review Core Phase 4 Patch Report

## F) Review Core Independent Project Picker
- Added a Review Core-only project model in SQLite:
  - `review_core_projects`
  - columns:
    - `id TEXT PRIMARY KEY`
    - `name TEXT NOT NULL`
    - `created_at TEXT NOT NULL`
    - `last_opened_at TEXT NOT NULL`
  - index:
    - `idx_review_core_projects_last_opened`
- Added backend commands:
  - `review_core_create_project(name) -> { id, name, last_opened_at }`
  - `review_core_list_projects() -> [{ id, name, last_opened_at }]`
  - `review_core_touch_project(project_id)`
- Review Core now supports a standalone project picker in `ReviewCore.tsx` when:
  - no `shareToken`
  - no active external `projectId`
- Share mode still bypasses the picker completely and renders the restricted share surface unchanged.
- Picker behavior:
  - `Create Project` creates a Review Core project and immediately opens it
  - `Open Existing` lists recent Review Core projects by name and last opened time
- Persistence:
  - last selected Review Core project is stored in localStorage:
    - `review_core:last_project_id`
  - Review Core project metadata is persisted in SQLite
  - reopening the app restores the last selected Review Core project automatically when available
- Compatibility detail:
  - standalone Review Core projects also seed a compatible row in the existing `projects` table so current asset/version/share scoping continues to work without changing the existing workspace-open model

## G) Media Workspace Card Density
- Review Core is no longer disabled in the Media Workspace launcher when no workspace is open.
- Launcher copy now reflects the new standalone Review Core flow.
- Media Workspace launcher cards were tightened without changing the 2-column grid:
  - reduced grid gap
  - reduced card padding
  - reduced card min-height
  - reduced icon container size
  - slightly reduced title/body spacing and text size
  - preserved equal sizing and alignment
- No new animations were introduced.

## Validation
1. `npm run build`
2. `cargo check`
3. `cargo test`

All three passed.
