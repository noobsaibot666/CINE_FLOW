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

            assert_eq!(report.source_path, source);
            assert_eq!(report.adapter_id, "libraw_still");
            assert_eq!(report.support_tier, "native_candidate");
            assert_eq!(
                report.raw_metadata.raw_format_family.as_deref(),
                Some("OPEN_CAMERA_RAW")
            );
            assert!(!report.analysis_ready);
            assert!(report
                .warnings
                .iter()
                .any(|warning| warning.contains("LibRaw")));
        }
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
