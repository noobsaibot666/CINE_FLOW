# RAW/OCIO Analysis V1.2 Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the V1.2 RAW/OCIO path so Camera Match Lab and Match & Normalize can make source-backed, color-managed analysis decisions.

**Architecture:** Build from metadata intent to executable transforms. First make source profile and analysis color space explicit in UI, request payloads, backend results, and saved provenance; then add OCIO validation/execution, LibRaw decode, proxy generation/validation, and confidence rules.

**Tech Stack:** Tauri, Rust, React, TypeScript, SQLite, FFmpeg/ffprobe, BRAW bridge, LibRaw, OpenColorIO/ACES, vendor CLI adapters where legally clean.

---

## Current State

- Camera Match Lab accepts broader RAW sources and explains which ones require proxies.
- Backend classifies video, BRAW, open camera RAW, vendor RAW, and proxy-guided RAW.
- RAW ingest reports exist, but open RAW is still `native_candidate`.
- ACES/OCIO transform metadata exists, but there is no user-selectable transform path and no real OCIO processor execution.
- Match & Normalize can consume saved Match Lab runs, but trust depends on metadata and proxy provenance, not decoded RAW pixels.

## Phase 3: Explicit Source Profile and ACES Intent

### Task 1: Persist Analysis Transform Intent

**Files:**
- Modify: `src-tauri/src/production_match_lab.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/types.ts`
- Modify: `src/components/Production/CameraMatchLabApp.tsx`

- [x] **Step 1: Write the failing backend test**

Add a test proving analysis result structs can carry transform intent:

```rust
#[test]
fn analysis_result_carries_transform_intent() {
    let mut result = sample_camera_match_analysis_result();
    result.source_profile_id = Some("SONY_SLOG3_SGAMUT3_CINE".to_string());
    result.analysis_color_space = Some("ACEScct".to_string());
    result.color_transform_status = Some("metadata_ready".to_string());

    let json = serde_json::to_string(&result).expect("serialize analysis result");
    let decoded: CameraMatchAnalysisResult =
        serde_json::from_str(&json).expect("deserialize analysis result");

    assert_eq!(decoded.source_profile_id.as_deref(), Some("SONY_SLOG3_SGAMUT3_CINE"));
    assert_eq!(decoded.analysis_color_space.as_deref(), Some("ACEScct"));
    assert_eq!(decoded.color_transform_status.as_deref(), Some("metadata_ready"));
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test production_match_lab::tests::analysis_result_carries_transform_intent`

Expected: FAIL because the result fields are missing.

- [x] **Step 3: Add result and request fields**

Add optional fields:

```rust
pub source_profile_id: Option<String>,
pub analysis_color_space: Option<String>,
pub color_transform_status: Option<String>,
```

Pass request values from `camera_match_analyze_clip` into `CameraMatchAnalysisResult`.

- [x] **Step 4: Update frontend types and invoke payload**

Add matching optional fields to `CameraMatchAnalysisResult` in `src/types.ts`.

Send:

```ts
sourceProfileId: sourceProfileBySlot[slot] ?? "REC709",
analysisColorSpace: analysisColorSpace,
```

- [x] **Step 5: Verify**

Run:

```bash
cd src-tauri && cargo test production_match_lab
npm run lint
npm run build
```

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/production_match_lab.rs src-tauri/src/commands.rs src/types.ts src/components/Production/CameraMatchLabApp.tsx
git commit -m "Carry Match Lab color transform intent"
```

## Phase 4: OCIO Config Validation and Transform Reports

### Task 2: Add OCIO Config Status Boundary

**Files:**
- Create: `src-tauri/src/production_ocio.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/types.ts`
- Modify: `src/components/Production/CameraMatchLabApp.tsx`

- [x] Add a backend command that reports whether an OCIO config path is bundled, configured, loadable, and compatible with the selected source profile.
- [x] Add UI states: `OCIO ready`, `Metadata only`, `Config missing`, `Unsupported transform`.
- [x] Keep analysis allowed in metadata-only mode but lower confidence.
- [x] Commit with `git commit -m "Add OCIO config readiness reporting"`.

## Phase 5: LibRaw Native Candidate Decode

### Task 3: Add LibRaw Adapter Boundary

**Files:**
- Create: `src-tauri/src/production_libraw.rs`
- Modify: `src-tauri/src/production_raw_ingest.rs`
- Modify: `src-tauri/src/production_media_capabilities.rs`
- Modify: `src-tauri/Cargo.toml`

- [x] Add a compile-time gated LibRaw adapter so packaging can be reviewed before shipping binaries.
- [x] Add metadata readiness fields for camera make/model, ISO, WB, black/white level, CFA, and color matrix extraction.
- [x] Add representative-frame decode readiness fields so future LibRaw builds can expose linear RGB decode only when available.
- [x] Keep unsupported builds honest: source remains selectable, but analysis requires proxy.
- [x] Commit with `git commit -m "Add LibRaw native candidate adapter boundary"`.

## Phase 6: OCIO CPU Transform Execution

### Task 4: Transform Decoded Frames Into Analysis Space

**Files:**
- Modify: `src-tauri/src/production_color_pipeline.rs`
- Modify: `src-tauri/src/production_match_lab.rs`
- Modify: `src-tauri/src/production_ocio.rs`

- [x] Add transform execution reporting that separates metadata-only, config-ready, processor-missing, missing-config, and unsupported states.
- [x] Store transform engine, OCIO config source/path/status, source profile, analysis space, and metrics trust in every result.
- [x] Mark metrics trusted only when decode and transform execution both pass.
- [x] Commit with `git commit -m "Apply OCIO analysis transforms"`.

## Phase 7: Proxy Generation and Validation

### Task 5: Restore and Generalize RAW Proxy Creation

**Files:**
- Modify: `src-tauri/src/production_match_lab.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/components/Production/CameraMatchLabApp.tsx`

- [x] Keep BRAW auto-proxy generation.
- [x] Add proxy validation for proxy-backed RAW analysis: duration/frame count where available, resolution, codec, source pairing, and color pipeline note.
- [x] Add UI warnings when proxy metadata is weak or mismatched.
- [x] Commit with `git commit -m "Validate RAW analysis proxies"`.

## Phase 8: Match & Normalize Trust Rules

### Task 6: Use Decode and Transform Provenance in Normalize Decisions

**Files:**
- Modify: `src/components/Production/MatchNormalizeApp.tsx`
- Modify: `src/components/Production/productionLogic.ts`
- Modify: `src-tauri/src/production_match_lab.rs`

- [ ] Penalize confidence when source profile is missing, OCIO is metadata-only, proxy provenance is weak, or chart calibration failed.
- [ ] Show the user why a match is trusted, provisional, or proxy-only.
- [ ] Export provenance in PDF/image reports.
- [ ] Commit with `git commit -m "Use transform provenance in Match Normalize"`.

## Phase 9: Public Astro Documentation

### Task 7: Document Only Production-Approved Features

**Files:**
- Modify: `docs/src/content/docs/technical/media-processing.md`
- Modify: `docs/src/content/docs/user-guide/production.md`
- Modify: `docs/src/content/docs/product/roadmap.md`

- [ ] Add docs only after each phase is verified and approved.
- [ ] Separate implemented behavior from planned roadmap.
- [ ] Commit with `git commit -m "Document approved RAW OCIO workflow"`.

## Self-Review

- Spec coverage: Covers transform intent, OCIO readiness, LibRaw decode, OCIO execution, proxy validation, Match & Normalize trust, and approved Astro docs.
- Placeholder scan: No `TBD`/`TODO` placeholders remain.
- Scope check: Each phase produces a testable increment and can ship without falsely claiming unsupported RAW decode.
- Type consistency: `source_profile_id`, `analysis_color_space`, and `color_transform_status` are the core provenance fields used across backend, frontend, storage, and exports.
