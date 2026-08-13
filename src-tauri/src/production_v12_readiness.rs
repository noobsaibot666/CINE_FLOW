use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct V12ReadinessDependencyState {
    pub import_picker_extended: bool,
    pub decode_labels_visible: bool,
    pub ocio_config_ready: bool,
    pub ocio_processor_available: bool,
    pub libraw_frame_decode_available: bool,
    pub app_info_diagnostics_visible: bool,
    pub macos_build_passed: bool,
    pub windows_build_passed: bool,
    pub astro_docs_approved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct V12ReadinessItem {
    pub id: String,
    pub label: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct V12ReadinessReport {
    pub release_ready: bool,
    pub ready_count: usize,
    pub total_count: usize,
    pub blockers: Vec<String>,
    pub items: Vec<V12ReadinessItem>,
}

pub fn build_v12_readiness_report(state: V12ReadinessDependencyState) -> V12ReadinessReport {
    let items = vec![
        item(
            "import-picker",
            "RAW import picker",
            state.import_picker_extended,
            "File browser accepts video, BRAW, vendor RAW, open camera RAW, and proxy-guided RAW extensions.",
            "RAW import picker still needs the extended format allow-list.",
        ),
        item(
            "decode-labels",
            "Decode path labels",
            state.decode_labels_visible,
            "Imported sources show Direct RAW, Vendor RAW, Proxy, Unsupported, or Provisional labels.",
            "Imported sources must show decode path labels before V1.2 approval.",
        ),
        item(
            "open-raw-libraw",
            "Open RAW direct decode",
            state.libraw_frame_decode_available,
            "LibRaw bridge reports frame decode availability for open camera RAW sources.",
            "LibRaw bridge is missing frame decode support; open camera RAW remains provisional.",
        ),
        item(
            "vendor-raw-guard",
            "Proprietary RAW guard",
            true,
            "Vendor and proprietary RAW formats stay on vendor decoder or operator proxy paths unless a legal decoder is available.",
            "Vendor RAW guard is not active.",
        ),
        item(
            "ocio-runtime",
            "OCIO runtime",
            state.ocio_config_ready && state.ocio_processor_available,
            "OCIO config and processor are both available for analysis-space transforms.",
            if state.ocio_config_ready {
                "OCIO processor is missing; configure CINEFLOW_OCIO_PROCESSOR or bundle bin/ocioconvert."
            } else {
                "OCIO config is missing; configure OCIO or bundle an ACES config."
            },
        ),
        item(
            "analysis-trust",
            "Analysis trust rule",
            state.ocio_config_ready
                && state.ocio_processor_available
                && state.libraw_frame_decode_available,
            "Metrics can be trusted after direct decode and successful OCIO frame transform.",
            "Metrics remain provisional until direct decode and OCIO frame transform are both available.",
        ),
        item(
            "proxy-provisional",
            "Proxy analysis labeling",
            true,
            "Proxy analysis remains explicit and provisional unless product policy changes.",
            "Proxy analysis labeling is not active.",
        ),
        item(
            "app-info-diagnostics",
            "Startup diagnostics",
            state.app_info_diagnostics_visible,
            "App info reports FFmpeg, FFprobe, BRAW, OCIO, and LibRaw diagnostics.",
            "Startup diagnostics are not visible in the app.",
        ),
        item(
            "macos-build",
            "macOS build",
            state.macos_build_passed,
            "macOS build and verification passed on this workspace.",
            "macOS build verification has not passed.",
        ),
        item(
            "windows-build",
            "Windows build",
            state.windows_build_passed,
            "Windows build passed with required sidecar binaries present and signed.",
            "Windows build still needs package validation with sidecars and signing.",
        ),
        item(
            "astro-docs",
            "Astro documentation approval",
            state.astro_docs_approved,
            "Astro docs are updated for production-approved V1.2 features.",
            "Astro docs should be updated only after manual production approval.",
        ),
    ];

    let blockers = items
        .iter()
        .filter(|item| item.status != "ready")
        .map(|item| format!("{}: {}", item.label, item.detail))
        .collect::<Vec<_>>();
    let ready_count = items.len() - blockers.len();

    V12ReadinessReport {
        release_ready: blockers.is_empty(),
        ready_count,
        total_count: items.len(),
        blockers,
        items,
    }
}

fn item(
    id: &str,
    label: &str,
    ready: bool,
    ready_detail: &str,
    blocked_detail: &str,
) -> V12ReadinessItem {
    V12ReadinessItem {
        id: id.to_string(),
        label: label.to_string(),
        status: if ready { "ready" } else { "blocked" }.to_string(),
        detail: if ready { ready_detail } else { blocked_detail }.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{build_v12_readiness_report, V12ReadinessDependencyState};

    #[test]
    fn release_readiness_is_blocked_when_runtime_transform_or_raw_decode_is_missing() {
        let report = build_v12_readiness_report(V12ReadinessDependencyState {
            import_picker_extended: true,
            decode_labels_visible: true,
            ocio_config_ready: true,
            ocio_processor_available: false,
            libraw_frame_decode_available: false,
            app_info_diagnostics_visible: true,
            macos_build_passed: true,
            windows_build_passed: false,
            astro_docs_approved: false,
        });

        assert!(!report.release_ready);
        assert_eq!(report.ready_count, 6);
        assert_eq!(report.total_count, 11);
        assert_eq!(report.items[2].id, "open-raw-libraw");
        assert_eq!(report.items[2].status, "blocked");
        assert_eq!(report.items[4].id, "ocio-runtime");
        assert_eq!(report.items[4].status, "blocked");
        assert!(report
            .blockers
            .iter()
            .any(|blocker| blocker.contains("OCIO processor")));
        assert!(report
            .blockers
            .iter()
            .any(|blocker| blocker.contains("LibRaw")));
    }

    #[test]
    fn release_readiness_can_pass_when_runtime_and_manual_gates_are_satisfied() {
        let report = build_v12_readiness_report(V12ReadinessDependencyState {
            import_picker_extended: true,
            decode_labels_visible: true,
            ocio_config_ready: true,
            ocio_processor_available: true,
            libraw_frame_decode_available: true,
            app_info_diagnostics_visible: true,
            macos_build_passed: true,
            windows_build_passed: true,
            astro_docs_approved: true,
        });

        assert!(report.release_ready);
        assert_eq!(report.ready_count, report.total_count);
        assert!(report.blockers.is_empty());
        assert!(report.items.iter().all(|item| item.status == "ready"));
    }
}
