# V1.2 RAW OCIO Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining V1.2 gaps so RAW decode provenance, OCIO/ACES processor readiness, analysis trust, and release documentation are wired end to end.

**Architecture:** Keep the pipeline honest: config discovery, processor availability, RAW decode capability, frame transform execution, and analysis trust are separate states. UI and docs may say “trusted” only when the backend can prove decoded frames were transformed into the requested analysis space. Proprietary RAW paths remain proxy/vendor based until a licensed decoder is available.

**Tech Stack:** Tauri 2, Rust, TypeScript/React UI, OpenColorIO/ACES config files, optional packaged OCIO processor executable, optional LibRaw bridge, FFmpeg/vendor proxy fallback.

---

## File Structure

- `src-tauri/src/production_ocio.rs`: OCIO config discovery and transform execution readiness reports.
- `src-tauri/src/production_ocio_processor.rs`: New focused runtime probe for a packaged or environment-provided OCIO processor.
- `src-tauri/src/commands.rs`: Wire runtime diagnostics into Match Lab and Production commands.
- `src-tauri/src/lib.rs`: Register new Rust module and command surface if needed.
- `src-tauri/tests/production_ocio_processor_tests.rs`: Processor probing and execution-status tests.
- `src-tauri/src/production_libraw.rs`: Move LibRaw from static stub to explicit runtime bridge contract.
- `src-tauri/tests/production_libraw_tests.rs`: LibRaw bridge behavior for missing, disabled, and bridge-present states.
- `src-tauri/src/production_raw_ingest.rs`: Route RAW files through direct decode, vendor decode, or proxy fallback with clear provenance.
- `src-tauri/src/production_media_capabilities.rs`: Surface user-facing capability labels and blockers.
- `src-tauri/src/production_image_analysis.rs`: Accept decoded/transformed frame provenance and mark trust.
- `src/pages/ProductionPage.tsx` and related components: Show import eligibility, decode path, OCIO processor state, and trust warnings.
- `docs/development/v1.2-raw-ocio-roadmap.md`: Engineering roadmap updated as phases complete.
- `docs/astro/`: Update only when a phase is production-approved.

---

### Task 1: Native OCIO Processor Readiness

**Files:**
- Create: `src-tauri/src/production_ocio_processor.rs`
- Modify: `src-tauri/src/production_ocio.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/production_ocio_processor_tests.rs`

- [x] **Step 1: Write failing tests**

```rust
use cineflow_suite_lib::production_ocio::{
    build_ocio_transform_execution_report_from_discovery,
    build_ocio_transform_execution_report_from_discovery_and_processor,
};
use cineflow_suite_lib::production_ocio_processor::ProductionOcioProcessorStatus;

#[test]
fn ocio_ready_without_processor_is_not_trusted() {
    let temp = tempfile::tempdir().unwrap();
    let config = temp.path().join("config.ocio");
    std::fs::write(&config, "ocio_profile_version: 2\n").unwrap();

    let report = build_ocio_transform_execution_report_from_discovery(
        "SONY_SLOG3_SGAMUT3_CINE",
        "ACEScct",
        Some(config.to_str().unwrap()),
        None,
    );

    assert_eq!(report.config_status, "ocio_ready");
    assert_eq!(report.execution_status, "processor_not_available");
    assert!(!report.processor_available);
    assert!(!report.metrics_trusted);
}

#[test]
fn ocio_ready_with_processor_is_ready_but_not_applied_until_frame_execution() {
    let temp = tempfile::tempdir().unwrap();
    let config = temp.path().join("config.ocio");
    std::fs::write(&config, "ocio_profile_version: 2\n").unwrap();

    let report = build_ocio_transform_execution_report_from_discovery_and_processor(
        "SONY_SLOG3_SGAMUT3_CINE",
        "ACEScct",
        Some(config.to_str().unwrap()),
        None,
        ProductionOcioProcessorStatus::available_for_test("/usr/local/bin/ocioconvert"),
    );

    assert_eq!(report.config_status, "ocio_ready");
    assert_eq!(report.execution_status, "processor_ready");
    assert!(report.processor_available);
    assert!(!report.metrics_trusted);
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml production_ocio_processor_tests -- --nocapture`
Expected: FAIL because `production_ocio_processor` and `build_ocio_transform_execution_report_from_discovery_and_processor` do not exist.

- [x] **Step 3: Add processor status module**

```rust
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionOcioProcessorStatus {
    pub processor_engine: String,
    pub processor_status: String,
    pub executable_path: Option<String>,
    pub can_execute: bool,
    pub warnings: Vec<String>,
}

impl ProductionOcioProcessorStatus {
    pub fn unavailable(message: impl Into<String>) -> Self {
        Self {
            processor_engine: "OpenColorIO processor".to_string(),
            processor_status: "processor_not_available".to_string(),
            executable_path: None,
            can_execute: false,
            warnings: vec![message.into()],
        }
    }

    #[cfg(test)]
    pub fn available_for_test(path: &str) -> Self {
        Self {
            processor_engine: "OpenColorIO processor".to_string(),
            processor_status: "processor_available".to_string(),
            executable_path: Some(path.to_string()),
            can_execute: true,
            warnings: Vec::new(),
        }
    }
}

pub fn probe_ocio_processor(resource_dir: Option<&Path>) -> ProductionOcioProcessorStatus {
    if let Some(path) = std::env::var("CINEFLOW_OCIO_PROCESSOR").ok().filter(|value| !value.trim().is_empty()) {
        return status_for_path(PathBuf::from(path), "environment");
    }

    if let Some(resource_dir) = resource_dir {
        let bundled = resource_dir.join("bin").join(platform_executable_name("ocioconvert"));
        if bundled.is_file() {
            return status_for_path(bundled, "bundled");
        }
    }

    ProductionOcioProcessorStatus::unavailable(
        "No OCIO processor executable was found. Configure CINEFLOW_OCIO_PROCESSOR or bundle bin/ocioconvert to enable pixel transforms.",
    )
}

fn status_for_path(path: PathBuf, source: &str) -> ProductionOcioProcessorStatus {
    if path.is_file() {
        ProductionOcioProcessorStatus {
            processor_engine: format!("OpenColorIO processor ({source})"),
            processor_status: "processor_available".to_string(),
            executable_path: Some(path.to_string_lossy().to_string()),
            can_execute: true,
            warnings: Vec::new(),
        }
    } else {
        ProductionOcioProcessorStatus::unavailable(format!(
            "Configured OCIO processor does not exist or is not a file: {}",
            path.to_string_lossy()
        ))
    }
}

fn platform_executable_name(name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}
```

- [x] **Step 4: Wire readiness into transform reports**

```rust
pub fn build_ocio_transform_execution_report_from_discovery_and_processor(
    source_profile_id: &str,
    analysis_color_space: &str,
    environment_path: Option<&str>,
    resource_dir: Option<&Path>,
    processor_status: crate::production_ocio_processor::ProductionOcioProcessorStatus,
) -> ProductionOcioTransformExecutionReport {
    let config_status = build_ocio_config_status_from_discovery(
        source_profile_id,
        analysis_color_space,
        environment_path,
        resource_dir,
    );
    build_ocio_transform_execution_report_from_config_status(config_status, processor_status)
}
```

Expected behavior: `processor_ready` means a processor is available for frame execution, not that pixels were already transformed. `metrics_trusted` remains false until a later task records successful per-frame execution.

- [x] **Step 5: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml production_ocio`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/production_ocio.rs src-tauri/src/production_ocio_processor.rs src-tauri/src/lib.rs src-tauri/tests/production_ocio_processor_tests.rs docs/superpowers/plans/2026-08-14-v12-raw-ocio-completion.md
git commit -m "Add OCIO processor readiness reporting"
```

### Task 2: OCIO Frame Transform Execution

**Files:**
- Create: `src-tauri/src/production_ocio_frame_transform.rs`
- Modify: `src-tauri/src/commands.rs`
- Test: `src-tauri/tests/production_ocio_frame_transform_tests.rs`

- [x] Add an execution function that receives input frame path, output frame path, config path, source color space, destination analysis space, and processor executable.
- [x] Test a fake processor executable that copies input to output and returns exit 0.
- [x] Test failure when the processor exits non-zero.
- [x] Wire Match Lab frame analysis to analyze transformed frames only when execution succeeds.
- [x] Set `execution_status = "transform_applied"` and `metrics_trusted = true` only for successfully transformed frames.
- [x] Commit with `git commit -m "Apply OCIO transforms to analysis frames"`.

### Task 3: LibRaw Runtime Bridge

**Files:**
- Modify: `src-tauri/src/production_libraw.rs`
- Modify: `src-tauri/src/production_raw_ingest.rs`
- Test: `src-tauri/tests/production_libraw_tests.rs`

- [x] Add `CINEFLOW_LIBRAW_BRIDGE` runtime probing.
- [x] Distinguish `adapter_disabled`, `bridge_missing`, `metadata_available`, and `frame_decode_available`.
- [x] Route open RAW formats to direct analysis only when `frame_decode_available = true`.
- [x] Keep RED/BRAW/ARRIRAW proprietary flows on vendor/proxy paths unless a legal decoder is detected.
- [x] Commit with `git commit -m "Add LibRaw runtime bridge readiness"`.

### Task 4: Analysis Trust Wiring

**Files:**
- Modify: `src-tauri/src/production_image_analysis.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/production_media_capabilities.rs`
- Test: relevant Rust tests under `src-tauri/tests/`

- [x] Add provenance fields for decode path, transform path, processor path, and fallback reason.
- [x] Ensure Match Normalize labels metrics trusted only when decode and OCIO transform both succeeded.
- [x] Ensure proxy analysis remains explicitly provisional.
- [x] Commit with `git commit -m "Use decode and transform provenance for analysis trust"`.

### Task 5: UI Import and Diagnostics Closure

**Files:**
- Modify: `src/pages/ProductionPage.tsx`
- Modify: relevant production components under `src/components/`
- Test: existing frontend build/test commands.

- [x] Let the file browser select all supported RAW extensions, not only BRAW.
- [x] Show decode path state beside imported files: Direct RAW, Vendor RAW, Proxy, Unsupported, or Provisional.
- [x] Show OCIO config status and processor status separately.
- [x] Add concise user-facing blockers when a RAW can be imported but cannot be trusted for analysis yet.
- [x] Commit with `git commit -m "Improve RAW import diagnostics in production UI"`.

### Task 6: Packaging and Release Gate

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `docs/development/v1.2-raw-ocio-roadmap.md`
- Modify: `docs/astro/` only after manual approval.

- [ ] Include bundled OCIO configs and processor binaries when present.
- [ ] Add startup diagnostics for OCIO config, OCIO processor, LibRaw bridge, BRAW, and FFmpeg.
- [ ] Add release checklist proving decode, transform, analysis, UI, and package states.
- [ ] Build and test the app.
- [ ] Commit with `git commit -m "Finalize V1.2 RAW OCIO release gate"`.

---

## Release Readiness Rule

V1.2 can be called ready only when:

- Open RAW files can be imported from the UI.
- Each RAW file receives an explicit decode path.
- Analysis frames are decoded or proxied with traceable provenance.
- OCIO config discovery and processor readiness are both visible.
- Metrics are marked trusted only after successful decode plus successful OCIO transform.
- Unsupported or proprietary formats never appear as trusted by accident.
- Astro docs describe only completed, tested, production-approved features.
