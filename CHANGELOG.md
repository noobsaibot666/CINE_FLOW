# Changelog

## 1.0.8

### Added
- **Safe Copy** moved into Pre-Production so verified media offload runs before editorial.
- **Duplicate Finder** scan options (minimum size, hidden files, extension and folder filters), a bulk-cleanup workflow (keep newest / oldest / shortest path, then verified move-to-Trash), and cancellable scans.
- **Reference Board** (renamed from Shot Planner) with grid-mosaic contact walls exported from the same view; the standalone Grid Mosaic module was removed.
- **Camera Match Lab**: expanded camera database across ARRI, Sony, Canon, Panasonic, Nikon, RED, Blackmagic, and Fujifilm, including recent cinema and hybrid bodies.
- **Cinema RAW decode for analysis** — BRAW and Apple ProRes RAW directly; R3D / R3D NE / Nikon N-RAW via an installed RED SDK / REDline; Canon Cinema RAW Light / Sony X-OCN / ARRIRAW via DaVinci Resolve. A Decoder Setup panel reports readiness, links the free downloads, and accepts an existing install; an explicit "Generate proxy" step runs the decode as a visible job.
- **Look Setup**: notes editor in a modal saved with the project; the results section is an on-set playbook with a readiness checklist.
- **Frame Preview**: drag-and-drop media anywhere on the window; larger working canvas and media rail.
- **Media Review**: click any filmstrip frame to enlarge and page through frames.
- **Starter Setup** moved from Pre-Production to Production.

### Improved
- **Production page**: Project Manager opens from a header menu that shows the active project; first empty visit prompts to create one; Jobs button is compact; an open-project pill stays visible.
- **On-Set Coach** and **Match & Normalize** restructured into numbered, higher-contrast workflows; Match & Normalize no longer repeats the generic method per camera.
- Camera Match Lab analysis: chroma-gated skin sampling and an evidence-aware confidence score.
- Contact-sheet PDF and image exports render in a clean black-and-white layout.
- Thumbnails are extracted at higher resolution for a sharper filmstrip and enlarge view.

### Fixed
- **FCPXML timeline export** now imports cleanly into Final Cut Pro and DaVinci Resolve: media links are written as percent-encoded `file://` URIs inside a media-representation element, frame rates use standard broadcast timebases, and marker durations follow the clip timebase.
- **Delivery & Export** dialog contrast: the panel no longer blends into the background, and the two conditional export buttons are one primary action.
- The Blackmagic RAW runtime is now a hard requirement in the macOS build check, so the BRAW decode path ships intact.

## 1.0.0-rc.1 — macOS App Store Readiness

### Added
- **Production Entitlements**: Added `com.apple.security.files.bookmarks.app-scope` for persistent filesystem access within the Sandbox.
- **Privacy Metadata**: Initialized `src-tauri/Info.plist` with mandatory App Store privacy descriptions (Camera, Microphone, Photo Library).
- **Embedded Libraries**: Added a dedicated `libs/` and `Frameworks/` strategy to bundle the RED SDK and Qt frameworks.

### Fixed
- **Sidecar Sandboxing**: Hardened `REDline` sidecar by bundling 40+ missing `.dylib` dependencies and 19 Qt frameworks. 
- **RPATH Patching**: Relinked `REDline` binaries (`aarch64` and `x86_64`) to look for dependencies internally using `@loader_path`, bypassing global system paths blocked by the Mac App Store sandbox.

### Changed
- Updated `tauri.conf.json` with production identifier `com.cineflow.suite` and Mac App Store category `public.app-category.video`.

## 1.0.0-beta.1

### Added
- Unified JobManager tracking across thumbnails, waveform, verification, clustering, Resolve export, and Director Pack export.
- Jobs panel with progress and cancellation.
- About panel with app/build/ffmpeg/system metadata.
- Feedback diagnostics bundle export (`.zip`).
- Director Pack unified export command and deterministic folder structure.
- Structured Resolve FCPXML generation with block/camera/select/master organization.
- Contact Sheet filter controls (All, Picks, Rating >= N).
- Resolve export scope: Current View Filter.

### Improved
- Verification background pipeline error handling and logging (no panic-style unwrap paths in background processing).
- Export confirmation prompts and output-folder opening behavior.
- XML escaping and deterministic export tests.
- Filmstrip metadata tags now include RAW-oriented fields with graceful fallback: `FMT`, `CODEC`, `ISO`, `WB`, and `TC`, plus unified metadata-row rendering in print/export layouts.
- Media Workspace launcher order and disabled-state hints were aligned; Jobs is now globally accessible in header with live status indicator.
- Review keyboard flow is scoped to review tabs and now includes focused clip ring + scroll-into-view.
- Rejected clips are now excluded from selection/export consistently in UI and backend export scope resolution.
- Review toolbar was streamlined to `Sort → Filter → Layout → View → Selection → Export`, and export-name input was removed from that toolbar row.
- Backend verification/contact PDF exports now include branded header/footer + smart-copy line.
- Safe Copy now supports a persisted 5-row verification queue per project with sequential execution, queue cancellation, per-row report exports, and combined branded Markdown/PDF queue reports.

### Changed
- Version bumped to `1.0.0-beta.1` across app metadata.
