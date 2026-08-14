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
    build_raw_ingest_report_with_libraw(source_path, None)
}

pub fn build_raw_ingest_report_from_environment_and_resources(
    source_path: &str,
    resource_dir: Option<&std::path::Path>,
) -> RawIngestReport {
    let libraw = crate::production_libraw::inspect_libraw_adapter_from_environment_and_resources(
        source_path,
        resource_dir,
    );
    build_raw_ingest_report_with_libraw(source_path, Some(libraw))
}

pub fn build_raw_ingest_report_with_libraw(
    source_path: &str,
    libraw_override: Option<crate::production_libraw::LibRawAdapterReport>,
) -> RawIngestReport {
    let mut capability = classify_media_source(source_path);
    let extension = extension_lowercase(source_path);
    let mut raw_metadata = RawMetadataReport {
        raw_format_family: Some(capability.format_family.clone()),
        ..RawMetadataReport::default()
    };
    let mut warnings = capability.warnings.clone();
    let mut format_family = capability.format_family.clone();
    let mut decode_path_kind = capability.decode_path_kind.clone();
    let mut proxy_required = capability.proxy_required;

    let (adapter_id, support_tier, analysis_ready) = match extension.as_deref() {
        Some("dng") | Some("arw") | Some("cr2") | Some("cr3") | Some("nef") | Some("nrw")
        | Some("raf") | Some("rw2") | Some("orf") | Some("srf") | Some("sr2") | Some("pef")
        | Some("srw") | Some("raw") | Some("rwl") | Some("iiq") => {
            let libraw = libraw_override
                .unwrap_or_else(|| crate::production_libraw::inspect_libraw_adapter(source_path));
            raw_metadata.decoder_family = libraw.decoder_family.clone();
            raw_metadata.decoder_version = Some(libraw.metadata_status.clone());
            raw_metadata.raw_format_family = Some("OPEN_CAMERA_RAW".to_string());
            format_family = "OPEN_CAMERA_RAW".to_string();
            decode_path_kind = if libraw.frame_decode_available {
                "direct_original".to_string()
            } else {
                "native_candidate".to_string()
            };
            proxy_required = libraw.proxy_required;
            raw_metadata.warnings.extend(libraw.warnings.clone());
            if libraw.frame_decode_available {
                warnings.push(
                    "Open camera RAW detected. LibRaw bridge reports frame decode availability for direct analysis."
                        .to_string(),
                );
            } else {
                warnings.push(
                    "Open camera RAW detected. LibRaw integration is required before direct ACES analysis is trusted."
                        .to_string(),
                );
            }
            warnings.extend(libraw.warnings);
            capability.format_family = format_family.clone();
            capability.decode_path_kind = decode_path_kind.clone();
            capability.direct_analysis_supported = libraw.frame_decode_available;
            capability.vendor_decoder_required = false;
            capability.proxy_required = proxy_required;
            capability.recommended_proxy_tool = if libraw.frame_decode_available {
                None
            } else {
                Some("LibRaw integration".to_string())
            };
            capability.warnings = warnings.clone();
            (
                "libraw_still",
                "native_candidate",
                libraw.frame_decode_available,
            )
        }
        Some("braw") => ("braw_bridge", "vendor", false),
        Some("r3d") | Some("nev") => ("redline", "vendor", false),
        Some("xocn") | Some("crm") | Some("rmf") => ("operator_proxy", "proxy", false),
        Some("mov") | Some("mp4") | Some("mxf") => {
            decode_path_kind = "probe_required".to_string();
            warnings.push(
                "Container source requires codec and source-profile probing before RAW/OCIO analysis readiness is trusted."
                    .to_string(),
            );
            capability.decode_path_kind = decode_path_kind.clone();
            capability.direct_analysis_supported = false;
            capability.warnings = warnings.clone();
            ("ffmpeg_video", "native", false)
        }
        _ => ("unsupported", "unsupported", false),
    };

    RawIngestReport {
        source_path: source_path.to_string(),
        adapter_id: adapter_id.to_string(),
        support_tier: support_tier.to_string(),
        format_family,
        decode_path_kind,
        analysis_ready,
        vendor_decoder_required: capability.vendor_decoder_required,
        proxy_required,
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
    use super::{build_raw_ingest_report, build_raw_ingest_report_with_libraw};
    use crate::production_libraw::LibRawAdapterReport;

    #[test]
    fn selects_libraw_adapter_for_open_camera_raw_extensions() {
        for source in [
            "/camera/A001.dng",
            "/camera/A001.arw",
            "/camera/A001.cr2",
            "/camera/A001.cr3",
            "/camera/A001.nef",
            "/camera/A001.nrw",
            "/camera/A001.raf",
            "/camera/A001.rw2",
            "/camera/A001.orf",
            "/camera/A001.srf",
            "/camera/A001.sr2",
            "/camera/A001.pef",
            "/camera/A001.srw",
            "/camera/A001.raw",
            "/camera/A001.rwl",
            "/camera/A001.iiq",
        ] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.source_path, source);
            assert_eq!(report.adapter_id, "libraw_still");
            assert_eq!(report.support_tier, "native_candidate");
            assert_eq!(report.format_family, "OPEN_CAMERA_RAW");
            assert_eq!(report.decode_path_kind, "native_candidate");
            assert!(report.proxy_required);
            assert_eq!(
                report.raw_metadata.raw_format_family.as_deref(),
                Some("OPEN_CAMERA_RAW")
            );
            assert_eq!(
                report.raw_metadata.decoder_version.as_deref(),
                Some(if cfg!(feature = "libraw") {
                    "adapter_enabled"
                } else {
                    "adapter_disabled"
                })
            );
            assert!(!report.analysis_ready);
            assert!(report
                .warnings
                .iter()
                .any(|warning| warning.contains("LibRaw")));
        }
    }

    #[test]
    fn open_camera_raw_is_analysis_ready_only_when_libraw_frame_decode_is_available() {
        let libraw = LibRawAdapterReport {
            source_path: "/camera/A001.nef".to_string(),
            adapter_id: "libraw_still".to_string(),
            support_tier: "native_candidate".to_string(),
            feature_enabled: false,
            metadata_status: "metadata_available".to_string(),
            decode_status: "frame_decode_available".to_string(),
            metadata_available: true,
            frame_decode_available: true,
            proxy_required: false,
            raw_format_family: Some("OPEN_CAMERA_RAW".to_string()),
            decoder_family: Some("LibRaw bridge".to_string()),
            warnings: Vec::new(),
        };

        let report = build_raw_ingest_report_with_libraw("/camera/A001.nef", Some(libraw));

        assert_eq!(report.decode_path_kind, "direct_original");
        assert!(report.analysis_ready);
        assert!(!report.proxy_required);
        assert_eq!(
            report.raw_metadata.decoder_version.as_deref(),
            Some("metadata_available")
        );
    }

    #[test]
    fn open_camera_raw_is_analysis_ready_with_nested_resource_libraw_bridge() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_raw_ingest_libraw_nested_{}",
            std::process::id()
        ));
        let resource_dir = root.join("Resources");
        let bin_dir = resource_dir.join("resources").join("bin");
        std::fs::create_dir_all(&bin_dir).expect("create nested libraw bin");
        std::fs::write(bin_dir.join("libraw_bridge"), "#!/bin/sh\n").expect("write fake bridge");

        let report = super::build_raw_ingest_report_from_environment_and_resources(
            "/camera/A001.nef",
            Some(&resource_dir),
        );

        assert_eq!(report.decode_path_kind, "direct_original");
        assert!(report.analysis_ready);
        assert!(!report.proxy_required);

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn selects_libraw_adapter_case_insensitively() {
        let report = build_raw_ingest_report("/camera/A001.ARW");

        assert_eq!(report.adapter_id, "libraw_still");
        assert_eq!(report.support_tier, "native_candidate");
        assert_eq!(report.format_family, "OPEN_CAMERA_RAW");
        assert_eq!(report.decode_path_kind, "native_candidate");
        assert!(report.proxy_required);
        assert_eq!(report.capability.format_family, "OPEN_CAMERA_RAW");
        assert_eq!(report.capability.decode_path_kind, "native_candidate");
        assert!(!report.capability.direct_analysis_supported);
        assert!(!report.capability.vendor_decoder_required);
        assert!(report.capability.proxy_required);
        assert_eq!(
            report.capability.recommended_proxy_tool.as_deref(),
            Some("LibRaw integration")
        );
    }

    #[test]
    fn keeps_vendor_cinema_raw_behind_vendor_adapters() {
        let braw = build_raw_ingest_report("/camera/A001.braw");
        assert_eq!(braw.adapter_id, "braw_bridge");
        assert_eq!(braw.support_tier, "vendor");
        assert_eq!(braw.decode_path_kind, "vendor_decoded");
        assert_eq!(
            braw.raw_metadata.raw_format_family.as_deref(),
            Some("BLACKMAGIC_RAW")
        );
        assert!(braw.vendor_decoder_required);

        let r3d = build_raw_ingest_report("/camera/A001.r3d");
        assert_eq!(r3d.adapter_id, "redline");
        assert_eq!(r3d.support_tier, "vendor");
        assert_eq!(
            r3d.raw_metadata.raw_format_family.as_deref(),
            Some("RED_R3D")
        );

        let nraw = build_raw_ingest_report("/camera/A001.nev");
        assert_eq!(nraw.adapter_id, "redline");
        assert_eq!(nraw.support_tier, "vendor");
        assert_eq!(
            nraw.raw_metadata.raw_format_family.as_deref(),
            Some("NIKON_NRAW")
        );
    }

    #[test]
    fn marks_proxy_guided_raw_formats_without_claiming_native_decode() {
        for source in ["/camera/A001.xocn", "/camera/A001.crm", "/camera/A001.rmf"] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "operator_proxy");
            assert_eq!(report.support_tier, "proxy");
            assert!(report.proxy_required);
            assert!(!report.analysis_ready);
            assert!(report
                .warnings
                .iter()
                .any(|warning| warning.contains("proxy")));
        }
    }

    #[test]
    fn marks_container_video_sources_as_probe_required() {
        for source in ["/camera/A001.mov", "/camera/A001.mp4", "/camera/A001.mxf"] {
            let report = build_raw_ingest_report(source);

            assert_eq!(report.adapter_id, "ffmpeg_video");
            assert_eq!(report.support_tier, "native");
            assert_eq!(report.decode_path_kind, "probe_required");
            assert!(!report.analysis_ready);
            assert!(!report.proxy_required);
            assert_eq!(report.capability.decode_path_kind, "probe_required");
            assert!(!report.capability.direct_analysis_supported);
            assert!(report
                .warnings
                .iter()
                .any(|warning| warning.contains("codec and source-profile probing")));
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
