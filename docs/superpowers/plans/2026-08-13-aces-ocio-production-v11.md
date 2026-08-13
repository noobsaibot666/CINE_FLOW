# ACES/OCIO Production V1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trustworthy ACES/OCIO-backed Production pipeline for Look Setup, Camera Match Lab, and Match & Normalize.

**Architecture:** Add a backend media capability layer, a shared source-profile registry, ACES/OCIO transform metadata, and confidence-scored Match & Normalize outputs. Keep proprietary RAW support honest by separating direct decode, vendor decode, operator proxy, camera proxy, and unsupported originals.

**Tech Stack:** Tauri, Rust, React, TypeScript, SQLite, FFmpeg/ffprobe, BRAW bridge, REDline, OpenColorIO/ACES profiles.

---

## File Structure

- Modify: `src-tauri/src/production_match_lab.rs` for media source classification and decode strategy helpers.
- Modify: `src-tauri/src/ffprobe.rs` for deeper codec, bit-depth, range, transfer, and primaries extraction.
- Modify: `src-tauri/src/commands.rs` for new Tauri commands and Match Lab persistence flow.
- Modify: `src-tauri/src/db.rs` for persisted capability/profile/analysis metadata.
- Create: `src-tauri/src/production_media_capabilities.rs` for source capability reports.
- Create: `src-tauri/src/production_color_pipeline.rs` for ACES/OCIO transform metadata and transform status.
- Modify: `src/components/Production/cameraProfiles.ts` to split camera bodies from source-profile metadata.
- Create: `src/components/Production/sourceProfiles.ts` for source color-space profiles used by Look Setup and Match Lab.
- Modify: `src/components/Production/LookSetupApp.tsx` to expose profile assumptions and missing metadata warnings.
- Modify: `src/components/Production/CameraMatchLabApp.tsx` to show decode path, source profile, ACES transform, and confidence.
- Modify: `src/components/Production/MatchNormalizeApp.tsx` to consume saved Match Lab runs and emit source-backed recommendations.
- Modify: `src/types.ts` for shared frontend/backend types.
- Modify: Astro docs only after a phase creates an approved production feature.
- Keep updated: `docs/superpowers/specs/2026-08-13-aces-ocio-production-v11-design.md`.

## Phase 1: Capability Detection Foundation

### Task 1: Add Media Capability Types

**Files:**
- Create: `src-tauri/src/production_media_capabilities.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: Rust unit tests in the new module

- [x] **Step 1: Write tests for file classification**

Add tests covering `.braw`, `.r3d`, `.nev`, `.crm`, `.rmf`, `.mxf`, `.mov`, `.mp4`, and unknown extensions.

```rust
#[test]
fn classifies_known_camera_sources() {
    assert_eq!(classify_media_source("/clip/A001.braw").format_family, "BLACKMAGIC_RAW");
    assert_eq!(classify_media_source("/clip/A001.r3d").format_family, "RED_R3D");
    assert_eq!(classify_media_source("/clip/A001.nev").format_family, "NIKON_NRAW");
    assert_eq!(classify_media_source("/clip/A001.crm").format_family, "CANON_CINEMA_RAW");
    assert_eq!(classify_media_source("/clip/A001.mov").format_family, "QUICKTIME");
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test production_media_capabilities`

Expected: compile failure because the module does not exist.

- [x] **Step 3: Implement capability structs**

Create `ProductionMediaCapabilityReport` with:

```rust
pub struct ProductionMediaCapabilityReport {
    pub source_path: String,
    pub format_family: String,
    pub decode_path_kind: String,
    pub direct_analysis_supported: bool,
    pub vendor_decoder_required: bool,
    pub proxy_required: bool,
    pub recommended_proxy_tool: Option<String>,
    pub warnings: Vec<String>,
}
```

- [x] **Step 4: Run tests**

Run: `cd src-tauri && cargo test production_media_capabilities`

Expected: all classification tests pass.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/production_media_capabilities.rs src-tauri/src/lib.rs
git commit -m "Add production media capability classification"
```

### Task 2: Expand ffprobe Metadata

**Files:**
- Modify: `src-tauri/src/ffprobe.rs`
- Test: existing ffprobe unit tests or new parser-only tests

- [x] **Step 1: Add parser tests for bit depth and color metadata**

Use JSON fixtures for streams with `pix_fmt`, `bits_per_raw_sample`, `color_range`, `color_space`, `color_transfer`, and `color_primaries`.

- [x] **Step 2: Run the parser tests**

Run: `cd src-tauri && cargo test ffprobe`

Expected: fail on missing fields.

- [x] **Step 3: Extend `ClipMetadata`**

Add optional fields:

```rust
pub pixel_format: Option<String>,
pub bit_depth: Option<u32>,
pub color_range: Option<String>,
pub codec_tag: Option<String>,
```

- [x] **Step 4: Run tests**

Run: `cd src-tauri && cargo test ffprobe`

Expected: parser tests pass.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/ffprobe.rs
git commit -m "Expand production media metadata probing"
```

## Phase 2: Source Profiles and ACES Transform Registry

### Task 3: Add Frontend Source Profiles

**Files:**
- Create: `src/components/Production/sourceProfiles.ts`
- Modify: `src/components/Production/cameraProfiles.ts`
- Test: `npm run lint`

- [x] **Step 1: Create source profile registry**

Define profile ids such as:

```ts
export type ProductionSourceProfileId =
  | "SONY_SLOG3_SGAMUT3_CINE"
  | "CANON_CLOG2_CINEMA_GAMUT"
  | "ARRI_LOGC3_WIDE_GAMUT"
  | "ARRI_LOGC4_WIDE_GAMUT4"
  | "RED_LOG3G10_RED_WIDE_GAMUT"
  | "BMD_FILM_GEN5_WIDE_GAMUT"
  | "PANASONIC_VLOG_VGAMUT"
  | "FUJI_FLOG2_FGAMUT"
  | "NIKON_NLOG"
  | "REC709";
```

- [x] **Step 2: Connect camera modes to source profiles**

Replace loose `signalProfile` use where needed with a source profile id while keeping existing UI labels stable.

- [x] **Step 3: Run TypeScript**

Run: `npm run lint`

Expected: no TypeScript errors.

- [x] **Step 4: Commit**

```bash
git add src/components/Production/sourceProfiles.ts src/components/Production/cameraProfiles.ts
git commit -m "Add production source color profiles"
```

### Task 4: Add Backend ACES Transform Metadata

**Files:**
- Create: `src-tauri/src/production_color_pipeline.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: Rust unit tests in the new module

- [x] **Step 1: Add transform registry tests**

Verify each supported profile returns an ACES target and a status.

- [x] **Step 2: Implement transform metadata**

Include:

```rust
pub struct ProductionColorTransformReport {
    pub source_profile_id: String,
    pub analysis_space: String,
    pub transform_engine: String,
    pub transform_status: String,
    pub warnings: Vec<String>,
}
```

- [x] **Step 3: Run tests**

Run: `cd src-tauri && cargo test production_color_pipeline`

Expected: registry tests pass.

- [x] **Step 4: Commit**

```bash
git add src-tauri/src/production_color_pipeline.rs src-tauri/src/lib.rs
git commit -m "Add ACES transform metadata registry"
```

## Phase 3: Camera Match Lab Trust Layer

### Task 5: Surface Capability Reports in Camera Match Lab

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/types.ts`
- Modify: `src/components/Production/CameraMatchLabApp.tsx`

- [ ] **Step 1: Add command contract**

Create a Tauri command named `production_get_media_capability_report` that returns the backend report for a source path.

- [ ] **Step 2: Add frontend type**

Add `ProductionMediaCapabilityReport` to `src/types.ts` with fields matching Rust serialization.

- [ ] **Step 3: Show capability state per slot**

For each selected slot, show:

```text
Analysis source: Original / Vendor decode / Operator proxy / Proxy required
Source profile: detected or manual
ACES path: source profile -> ACEScct
Confidence: high / medium / low
```

- [ ] **Step 4: Verify**

Run: `npm run lint`

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src/types.ts src/components/Production/CameraMatchLabApp.tsx
git commit -m "Show media capability reports in Camera Match Lab"
```

### Task 6: Persist Analysis Provenance

**Files:**
- Modify: `src-tauri/src/db.rs`
- Modify: `src-tauri/src/production_match_lab.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/types.ts`

- [ ] **Step 1: Add migration tests or schema assertions**

Verify older `production_matchlab_results` rows remain readable when new fields are null.

- [ ] **Step 2: Add nullable columns**

Add columns for:

```text
capability_json
source_profile_id
analysis_color_space
decode_path_kind
confidence_score
```

- [ ] **Step 3: Save provenance with every run**

When saving Match Lab runs, persist capability report and transform metadata beside metrics.

- [ ] **Step 4: Verify**

Run: `cd src-tauri && cargo test production_matchlab`

Expected: existing and new persistence tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/db.rs src-tauri/src/production_match_lab.rs src-tauri/src/commands.rs src/types.ts
git commit -m "Persist Camera Match Lab provenance"
```

## Phase 4: Match & Normalize as Trustworthy Source

### Task 7: Load Match Lab Runs in Match & Normalize

**Files:**
- Modify: `src/components/Production/MatchNormalizeApp.tsx`
- Modify: `src/components/Production/productionLogic.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add payload builder tests**

Verify payload generation uses saved analysis metrics when a run is selected and falls back to setup checklist only when no run exists.

- [ ] **Step 2: Add run selection UI**

Load `production_matchlab_list_runs`, allow selecting a run, and display the selected run timestamp and hero slot.

- [ ] **Step 3: Generate evidence-backed steps**

Steps must include measured exposure, WB/tint, chart quality, and decode path warnings when available.

- [ ] **Step 4: Verify**

Run: `npm run lint`

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Production/MatchNormalizeApp.tsx src/components/Production/productionLogic.ts src/types.ts
git commit -m "Use Match Lab runs in Match and Normalize"
```

### Task 8: Add Confidence Scoring

**Files:**
- Modify: `src/components/Production/productionLogic.ts`
- Modify: `src-tauri/src/production_match_lab.rs`

- [ ] **Step 1: Add confidence tests**

Verify confidence decreases for operator proxies, unsupported originals, missing profiles, failed chart detection, clipped patches, and low frame count.

- [ ] **Step 2: Implement confidence model**

Use a 0-100 score with labels:

```text
85-100 high
65-84 usable
40-64 caution
0-39 low trust
```

- [ ] **Step 3: Display labels in UI and exports**

Show confidence beside recommendations and include it in exported reports.

- [ ] **Step 4: Verify**

Run: `npm run lint && cd src-tauri && cargo test production_match_lab`

Expected: frontend and backend checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Production/productionLogic.ts src-tauri/src/production_match_lab.rs
git commit -m "Add production match confidence scoring"
```

## Phase 5: Documentation and Release Tracking

### Task 9: Publish Approved Feature Documentation

**Files:**
- Modify: `docs/src/content/docs/product/roadmap.md` only after a phase is production-approved
- Modify: the relevant user-guide or technical Astro page for the approved feature

- [ ] **Step 1: Confirm production approval**

Do not publish active development status in Astro. Publish only finalized user-facing behavior, such as:

```text
Camera Match Lab now labels original, vendor-decoded, and proxy-based analysis paths.
Match & Normalize now includes confidence and provenance in exported reports.
```

- [ ] **Step 2: Verify docs**

Run: `cd docs && npm run build`

Expected: Astro builds successfully.

- [ ] **Step 3: Commit**

```bash
git add docs/src/content/docs/product/roadmap.md docs/src/content/docs/technical/media-processing.md docs/src/content/docs/user-guide/production.md
git commit -m "Document approved production color workflow"
```

## Plan Self-Review

- Spec coverage: capability detection, source profiles, ACES transform metadata, Match Lab provenance, Match & Normalize trust output, and final approved Astro docs are represented.
- Placeholder scan: no task depends on unspecified files or unnamed functionality.
- Type consistency: source profile, capability report, transform report, and confidence fields are named consistently across tasks.
