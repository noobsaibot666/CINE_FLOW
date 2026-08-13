# RAW/OCIO Analysis V1.2 Phase 1-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1.2 foundation for trustworthy RAW/OCIO analysis by documenting decode support tiers and adding a unified backend RAW ingest report contract.

**Architecture:** Keep the current V1.1 media capability classifier intact, then wrap it in a new `production_raw_ingest` module that adds adapter selection, support tier, RAW metadata fields, and analysis readiness. Expose the report through a Tauri command so Camera Match Lab and Match & Normalize can adopt it in the next implementation slice without changing the analysis engine yet.

**Tech Stack:** Tauri 2, Rust, serde, existing Production media capability module, React/TypeScript for command-facing types.

---

## Scope

This plan implements V1.2 roadmap Phase 1 and Phase 2 only.

Included:
- internal dependency/license/support matrix documentation
- Rust ingest contract and structured reports
- deterministic adapter selection for open RAW, vendor RAW, proxy-required RAW, and normal video
- Tauri command for ingest reports
- TypeScript command-facing types
- unit tests proving the new selection behavior

Excluded:
- LibRaw binary integration
- real OCIO CPU/GPU pixel transforms
- decoded frame extraction
- Camera Match Lab UI replacement
- public Astro documentation

Public docs remain unchanged until a production-approved feature ships.

## File Structure

- Create: `docs/superpowers/research/raw-ocio-v12-support-matrix.md`
  - Internal dependency, license, and support-tier notes for V1.2.
- Create: `src-tauri/src/production_raw_ingest.rs`
  - Rust report types, adapter selection, metadata skeleton, and tests.
- Modify: `src-tauri/src/lib.rs`
  - Register the new Rust module and Tauri command.
- Modify: `src-tauri/src/commands.rs`
  - Add `production_get_raw_ingest_report`.
- Modify: `src/types.ts`
  - Add TypeScript interfaces matching the Rust ingest report.

---

### Task 1: Add Internal Support Matrix

**Files:**
- Create: `docs/superpowers/research/raw-ocio-v12-support-matrix.md`

- [ ] **Step 1: Create the support-matrix document**

Use `apply_patch` to add:

```markdown
# RAW/OCIO V1.2 Support Matrix

## Purpose

This document locks the first V1.2 implementation boundary for RAW ingest and OCIO analysis. It is internal planning documentation and must not be copied to Astro public docs until the related feature is production approved.

## Ship Strategy

CineFlow separates file access from color management:

- decode adapters read source pixels or metadata
- source profiles identify camera/log color space
- OCIO transforms normalized decoded pixels into an ACES analysis space
- analysis reports include the path used and confidence limits

OCIO does not decode camera RAW files. RAW decode requires an open decoder, vendor SDK, vendor CLI, or operator-created proxy.

## Dependency Decisions

| Area | V1.2 Decision | Packaging Tier | Notes |
| --- | --- | --- | --- |
| Open still/camera RAW | Prepare for LibRaw integration | native_candidate | Use for `.dng`, `.arw`, `.cr2`, `.cr3`, `.nef`, `.raf`, `.rw2`, `.orf`; license and binary packaging must be reviewed before embedding. |
| OCIO config/execution | Prepare backend command boundary first | native_candidate | CPU execution comes after report contract; config validation must be visible before transforms are trusted. |
| H.264/H.265/HEVC containers | Keep existing FFmpeg/proxy path | native | Direct analysis remains allowed when source profile is known or manually selected. |
| BRAW | Keep vendor-backed path | vendor | Formalize behind ingest adapter; do not claim native decode unless the bridge is available. |
| RED R3D / Nikon N-RAW | Vendor CLI or SDK path | vendor | REDline/SDK availability controls analysis confidence. |
| Sony X-OCN | Proxy-guided path | proxy | Use Catalyst/NLE exports until a legally clean decode path is approved. |
| Canon Cinema RAW Light | Proxy-guided path | proxy | Use Canon Cinema RAW Development/NLE export until a legally clean decode path is approved. |
| ProRes RAW | Proxy-required path | proxy | Treat as proxy-required unless Apple/legal decode path is approved. |
| Unknown extensions | Unsupported original | unsupported | Ask for a supported mezzanine/proxy. |

## Support Tiers

| Tier | Meaning | UI Promise |
| --- | --- | --- |
| native | CineFlow can analyze the original or prepared source directly with bundled capability. | Direct analysis available. |
| native_candidate | Architecture supports a native adapter, but dependency packaging is not shipped yet. | Planned native path; current build may need proxy/vendor workflow. |
| vendor | Requires an installed or bundled vendor SDK/CLI/bridge. | Vendor decode required before trusted analysis. |
| proxy | Requires operator-created proxy or vendor-generated transcode. | Proxy workflow required. |
| unsupported | No supported ingest path is known. | Import a supported proxy. |

## Phase 1 Acceptance

- every targeted camera/media family has a support tier
- proprietary cinema RAW limitations are explicit
- OCIO is documented as a transform layer, not a decoder
- public Astro docs remain untouched
```

- [ ] **Step 2: Verify the document has no unfinished markers**

Run:

```bash
rg -n 'T''BD|TO''DO|implement late''r|fill i''n|\?\?' docs/superpowers/research/raw-ocio-v12-support-matrix.md
```

Expected: no matches and exit code `1`.

- [ ] **Step 3: Commit Task 1**

Run:

```bash
git add docs/superpowers/research/raw-ocio-v12-support-matrix.md
git commit -m "Document V1.2 RAW OCIO support matrix"
```

Expected: commit succeeds.

---

### Task 2: Write Failing RAW Ingest Adapter Tests

**Files:**
- Create: `src-tauri/src/production_raw_ingest.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Register the new module**

In `src-tauri/src/lib.rs`, add the module next to the existing production modules:

```rust
pub mod production_color_pipeline;
mod production_match_lab;
pub mod production_media_capabilities;
pub mod production_raw_ingest;
mod review_core;
```

- [ ] **Step 2: Add failing tests and type/API skeleton**

Create `src-tauri/src/production_raw_ingest.rs` with:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RawIngestReport {
    pub source_path: String,
}

pub fn build_raw_ingest_report(source_path: &str) -> RawIngestReport {
    RawIngestReport {
        source_path: source_path.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::build_raw_ingest_report;

    #[test]
    fn selects_libraw_adapter_for_open_camera_raw_extensions() {
        for source in [
            "/camera/A001.dng",
            "/camera/A001.arw",
            "/camera/A001.cr2",
            "/camera/A001.cr3",
            "/camera/A001.nef",
            "/camera/A001.raf",
            "/camera/A001.rw2",
            "/camera/A001.orf",
        ] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "libraw_still");
            assert_eq!(report.support_tier, "native_candidate");
            assert_eq!(report.raw_metadata.raw_format_family.as_deref(), Some("OPEN_CAMERA_RAW"));
            assert!(!report.analysis_ready);
            assert!(report.warnings.iter().any(|warning| warning.contains("LibRaw")));
        }
    }

    #[test]
    fn keeps_vendor_cinema_raw_behind_vendor_adapters() {
        let braw = build_raw_ingest_report("/camera/A001.braw");
        assert_eq!(braw.adapter_id, "braw_bridge");
        assert_eq!(braw.support_tier, "vendor");
        assert_eq!(braw.decode_path_kind, "vendor_decoded");
        assert!(braw.vendor_decoder_required);

        let r3d = build_raw_ingest_report("/camera/A001.r3d");
        assert_eq!(r3d.adapter_id, "redline");
        assert_eq!(r3d.support_tier, "vendor");
        assert_eq!(r3d.raw_metadata.raw_format_family.as_deref(), Some("RED_R3D"));

        let nraw = build_raw_ingest_report("/camera/A001.nev");
        assert_eq!(nraw.adapter_id, "redline");
        assert_eq!(nraw.support_tier, "vendor");
        assert_eq!(nraw.raw_metadata.raw_format_family.as_deref(), Some("NIKON_NRAW"));
    }

    #[test]
    fn marks_proxy_guided_raw_formats_without_claiming_native_decode() {
        for source in ["/camera/A001.xocn", "/camera/A001.crm", "/camera/A001.rmf"] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "operator_proxy");
            assert_eq!(report.support_tier, "proxy");
            assert!(report.proxy_required);
            assert!(!report.analysis_ready);
            assert!(report.warnings.iter().any(|warning| warning.contains("proxy")));
        }
    }

    #[test]
    fn preserves_existing_direct_video_analysis_path() {
        for source in ["/camera/A001.mov", "/camera/A001.mp4", "/camera/A001.mxf"] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "ffmpeg_video");
            assert_eq!(report.support_tier, "native");
            assert_eq!(report.decode_path_kind, "direct_original");
            assert!(report.analysis_ready);
            assert!(!report.proxy_required);
        }
    }

    #[test]
    fn marks_unknown_sources_as_unsupported() {
        let report = build_raw_ingest_report("/camera/A001.zzz");

        assert_eq!(report.adapter_id, "unsupported");
        assert_eq!(report.support_tier, "unsupported");
        assert_eq!(report.decode_path_kind, "unsupported_original");
        assert!(!report.analysis_ready);
        assert!(report.proxy_required);
        assert!(!report.warnings.is_empty());
    }
}
```

- [ ] **Step 3: Run the focused Rust test and verify RED**

Run:

```bash
cd src-tauri && cargo test production_raw_ingest
```

Expected: compile failure because `RawIngestReport` does not define `adapter_id`, `support_tier`, `raw_metadata`, `analysis_ready`, `warnings`, `decode_path_kind`, `vendor_decoder_required`, or `proxy_required`.

---

### Task 3: Implement RAW Ingest Report Contract

**Files:**
- Modify: `src-tauri/src/production_raw_ingest.rs`

- [ ] **Step 1: Replace the skeleton with the minimal implementation**

Use this complete implementation:

```rust
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::production_media_capabilities::{
    classify_media_source, ProductionMediaCapabilityReport,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct RawMetadataReport {
    pub decoder_family: Option<String>,
    pub decoder_version: Option<String>,
    pub raw_format_family: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub camera_serial: Option<String>,
    pub lens_model: Option<String>,
    pub iso: Option<String>,
    pub shutter: Option<String>,
    pub aperture: Option<String>,
    pub white_balance: Option<String>,
    pub wb_multipliers: Option<Vec<String>>,
    pub cfa_pattern: Option<String>,
    pub black_level: Option<String>,
    pub white_level: Option<String>,
    pub bit_depth: Option<String>,
    pub active_area: Option<String>,
    pub color_matrix: Option<String>,
    pub embedded_color_profile: Option<String>,
    pub timecode: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RawIngestReport {
    pub source_path: String,
    pub adapter_id: String,
    pub support_tier: String,
    pub format_family: String,
    pub decode_path_kind: String,
    pub analysis_ready: bool,
    pub vendor_decoder_required: bool,
    pub proxy_required: bool,
    pub recommended_proxy_tool: Option<String>,
    pub raw_metadata: RawMetadataReport,
    pub capability: ProductionMediaCapabilityReport,
    pub warnings: Vec<String>,
}

pub fn build_raw_ingest_report(source_path: &str) -> RawIngestReport {
    let capability = classify_media_source(source_path);
    let extension = extension_lowercase(source_path);
    let mut raw_metadata = RawMetadataReport {
        raw_format_family: Some(capability.format_family.clone()),
        ..RawMetadataReport::default()
    };
    let mut warnings = capability.warnings.clone();

    let (adapter_id, support_tier, analysis_ready) = match extension.as_deref() {
        Some("dng") | Some("arw") | Some("cr2") | Some("cr3") | Some("nef") | Some("raf")
        | Some("rw2") | Some("orf") => {
            raw_metadata.decoder_family = Some("LibRaw".to_string());
            raw_metadata.raw_format_family = Some("OPEN_CAMERA_RAW".to_string());
            raw_metadata.warnings.push(
                "LibRaw metadata extraction is planned for this native candidate; current builds do not decode it yet."
                    .to_string(),
            );
            warnings.push(
                "Open camera RAW detected. LibRaw integration is required before direct ACES analysis is trusted."
                    .to_string(),
            );
            ("libraw_still", "native_candidate", false)
        }
        Some("braw") => ("braw_bridge", "vendor", false),
        Some("r3d") | Some("nev") => ("redline", "vendor", false),
        Some("xocn") | Some("crm") | Some("rmf") => ("operator_proxy", "proxy", false),
        Some("mov") | Some("mp4") | Some("mxf") => ("ffmpeg_video", "native", true),
        _ => ("unsupported", "unsupported", false),
    };

    RawIngestReport {
        source_path: source_path.to_string(),
        adapter_id: adapter_id.to_string(),
        support_tier: support_tier.to_string(),
        format_family: capability.format_family.clone(),
        decode_path_kind: capability.decode_path_kind.clone(),
        analysis_ready,
        vendor_decoder_required: capability.vendor_decoder_required,
        proxy_required: capability.proxy_required,
        recommended_proxy_tool: capability.recommended_proxy_tool.clone(),
        raw_metadata,
        capability,
        warnings,
    }
}

fn extension_lowercase(source_path: &str) -> Option<String> {
    Path::new(source_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::build_raw_ingest_report;

    #[test]
    fn selects_libraw_adapter_for_open_camera_raw_extensions() {
        for source in [
            "/camera/A001.dng",
            "/camera/A001.arw",
            "/camera/A001.cr2",
            "/camera/A001.cr3",
            "/camera/A001.nef",
            "/camera/A001.raf",
            "/camera/A001.rw2",
            "/camera/A001.orf",
        ] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "libraw_still");
            assert_eq!(report.support_tier, "native_candidate");
            assert_eq!(report.raw_metadata.raw_format_family.as_deref(), Some("OPEN_CAMERA_RAW"));
            assert!(!report.analysis_ready);
            assert!(report.warnings.iter().any(|warning| warning.contains("LibRaw")));
        }
    }

    #[test]
    fn keeps_vendor_cinema_raw_behind_vendor_adapters() {
        let braw = build_raw_ingest_report("/camera/A001.braw");
        assert_eq!(braw.adapter_id, "braw_bridge");
        assert_eq!(braw.support_tier, "vendor");
        assert_eq!(braw.decode_path_kind, "vendor_decoded");
        assert!(braw.vendor_decoder_required);

        let r3d = build_raw_ingest_report("/camera/A001.r3d");
        assert_eq!(r3d.adapter_id, "redline");
        assert_eq!(r3d.support_tier, "vendor");
        assert_eq!(r3d.raw_metadata.raw_format_family.as_deref(), Some("RED_R3D"));

        let nraw = build_raw_ingest_report("/camera/A001.nev");
        assert_eq!(nraw.adapter_id, "redline");
        assert_eq!(nraw.support_tier, "vendor");
        assert_eq!(nraw.raw_metadata.raw_format_family.as_deref(), Some("NIKON_NRAW"));
    }

    #[test]
    fn marks_proxy_guided_raw_formats_without_claiming_native_decode() {
        for source in ["/camera/A001.xocn", "/camera/A001.crm", "/camera/A001.rmf"] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "operator_proxy");
            assert_eq!(report.support_tier, "proxy");
            assert!(report.proxy_required);
            assert!(!report.analysis_ready);
            assert!(report.warnings.iter().any(|warning| warning.contains("proxy")));
        }
    }

    #[test]
    fn preserves_existing_direct_video_analysis_path() {
        for source in ["/camera/A001.mov", "/camera/A001.mp4", "/camera/A001.mxf"] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "ffmpeg_video");
            assert_eq!(report.support_tier, "native");
            assert_eq!(report.decode_path_kind, "direct_original");
            assert!(report.analysis_ready);
            assert!(!report.proxy_required);
        }
    }

    #[test]
    fn marks_unknown_sources_as_unsupported() {
        let report = build_raw_ingest_report("/camera/A001.zzz");

        assert_eq!(report.adapter_id, "unsupported");
        assert_eq!(report.support_tier, "unsupported");
        assert_eq!(report.decode_path_kind, "unsupported_original");
        assert!(!report.analysis_ready);
        assert!(report.proxy_required);
        assert!(!report.warnings.is_empty());
    }
}
```

- [ ] **Step 2: Run the focused Rust test and verify GREEN**

Run:

```bash
cd src-tauri && cargo test production_raw_ingest
```

Expected: all `production_raw_ingest` tests pass.

- [ ] **Step 3: Commit Task 3**

Run:

```bash
git add src-tauri/src/lib.rs src-tauri/src/production_raw_ingest.rs
git commit -m "Add production RAW ingest report contract"
```

Expected: commit succeeds.

---

### Task 4: Expose RAW Ingest Report Through Tauri

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the command function**

In `src-tauri/src/commands.rs`, immediately after `production_get_media_capability_report`, add:

```rust
#[tauri::command]
pub async fn production_get_raw_ingest_report(
    source_path: String,
) -> Result<crate::production_raw_ingest::RawIngestReport, String> {
    Ok(crate::production_raw_ingest::build_raw_ingest_report(&source_path))
}
```

- [ ] **Step 2: Add the command to debug registry text**

In `src-tauri/src/lib.rs`, add this string after `"production_get_media_capability_report"`:

```rust
"production_get_raw_ingest_report",
```

- [ ] **Step 3: Add the command to `generate_handler!`**

In `src-tauri/src/lib.rs`, add this handler immediately after `commands::production_get_media_capability_report`:

```rust
commands::production_get_raw_ingest_report,
```

- [ ] **Step 4: Verify Rust command compilation**

Run:

```bash
cd src-tauri && cargo test production_raw_ingest
```

Expected: focused tests pass and the crate compiles with the new command registered.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "Expose production RAW ingest reports"
```

Expected: commit succeeds.

---

### Task 5: Add Frontend Types for the New Report

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add TypeScript interfaces**

In `src/types.ts`, near `ProductionMediaCapabilityReport`, add:

```typescript
export interface RawMetadataReport {
    decoder_family?: string | null;
    decoder_version?: string | null;
    raw_format_family?: string | null;
    camera_make?: string | null;
    camera_model?: string | null;
    camera_serial?: string | null;
    lens_model?: string | null;
    iso?: string | null;
    shutter?: string | null;
    aperture?: string | null;
    white_balance?: string | null;
    wb_multipliers?: string[] | null;
    cfa_pattern?: string | null;
    black_level?: string | null;
    white_level?: string | null;
    bit_depth?: string | null;
    active_area?: string | null;
    color_matrix?: string | null;
    embedded_color_profile?: string | null;
    timecode?: string | null;
    warnings: string[];
}

export interface RawIngestReport {
    source_path: string;
    adapter_id: string;
    support_tier: "native" | "native_candidate" | "vendor" | "proxy" | "unsupported" | string;
    format_family: string;
    decode_path_kind: string;
    analysis_ready: boolean;
    vendor_decoder_required: boolean;
    proxy_required: boolean;
    recommended_proxy_tool?: string | null;
    raw_metadata: RawMetadataReport;
    capability: ProductionMediaCapabilityReport;
    warnings: string[];
}
```

- [ ] **Step 2: Run TypeScript/lint verification**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 3: Commit Task 5**

Run:

```bash
git add src/types.ts
git commit -m "Add frontend RAW ingest report types"
```

Expected: commit succeeds.

---

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run Rust tests**

Run:

```bash
cd src-tauri && cargo test
```

Expected: all Rust tests pass.

- [ ] **Step 2: Run frontend lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 3: Verify public Astro docs were not changed**

Run:

```bash
git diff --name-only HEAD
```

Expected before final commit: only `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/production_raw_ingest.rs`, `src/types.ts`, and `docs/superpowers/research/raw-ocio-v12-support-matrix.md` if any task was not already committed.

- [ ] **Step 4: Verify no unfinished markers**

Run:

```bash
rg -n 'T''BD|TO''DO|implement late''r|fill i''n|\?\?' docs/superpowers/plans/2026-08-13-raw-ocio-analysis-v12-phase-1-2.md docs/superpowers/research/raw-ocio-v12-support-matrix.md src-tauri/src/production_raw_ingest.rs src/types.ts
```

Expected: no matches and exit code `1`.

## Self-Review

- Spec coverage: This plan covers V1.2 Phase 1 dependency/support lock and Phase 2 RAW ingest interface. LibRaw decode, OCIO execution, Camera Match Lab adoption, Match & Normalize adoption, and cinema RAW adapter expansion remain in later plans.
- Placeholder scan: The plan avoids unfinished implementation markers. The word `proxy-required` is intentional support-tier language.
- Type consistency: Rust `RawMetadataReport` and `RawIngestReport` fields match the TypeScript interfaces. Command name is consistently `production_get_raw_ingest_report`.
