use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionMediaCapabilityReport {
    pub source_path: String,
    pub format_family: String,
    pub decode_path_kind: String,
    pub direct_analysis_supported: bool,
    pub vendor_decoder_required: bool,
    pub proxy_required: bool,
    pub recommended_proxy_tool: Option<String>,
    pub warnings: Vec<String>,
    /// Live decode-provider availability for this format (see
    /// `production_decoder_status`). Populated by the capability-report command;
    /// `None` on the internal analysis path.
    #[serde(default)]
    pub decoder_status: Option<crate::production_decoder_status::DecoderStatus>,
}

pub fn classify_media_source(source_path: &str) -> ProductionMediaCapabilityReport {
    classify_media_source_with_libraw(source_path, None)
}

pub fn classify_media_source_from_environment_and_resources(
    source_path: &str,
    resource_dir: Option<&Path>,
) -> ProductionMediaCapabilityReport {
    let libraw = crate::production_libraw::inspect_libraw_adapter_from_environment_and_resources(
        source_path,
        resource_dir,
    );
    classify_media_source_with_libraw(source_path, Some(libraw))
}

pub fn classify_media_source_with_libraw(
    source_path: &str,
    libraw_override: Option<crate::production_libraw::LibRawAdapterReport>,
) -> ProductionMediaCapabilityReport {
    let extension = Path::new(source_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());

    match extension.as_deref() {
        Some("braw") => vendor_decoded(
            source_path,
            "BLACKMAGIC_RAW",
            "Blackmagic RAW SDK / CineFlow BRAW bridge",
        ),
        Some("r3d") => vendor_decoded(source_path, "RED_R3D", "REDline / RED R3D SDK"),
        Some("nev") => vendor_decoded(source_path, "NIKON_NRAW", "REDline / RED R3D SDK"),
        Some("dng") | Some("arw") | Some("cr2") | Some("cr3") | Some("nef") | Some("nrw")
        | Some("raf") | Some("rw2") | Some("orf") | Some("srf") | Some("sr2")
        | Some("pef") | Some("srw") | Some("raw") | Some("rwl") | Some("iiq") => {
            let libraw = libraw_override
                .unwrap_or_else(|| crate::production_libraw::inspect_libraw_adapter(source_path));
            if libraw.frame_decode_available {
                return direct_original(
                    source_path,
                    "OPEN_CAMERA_RAW",
                    vec![
                        "Open camera RAW source detected. LibRaw bridge reports frame decode availability for direct analysis."
                            .to_string(),
                    ],
                );
            }
            native_candidate(
                source_path,
                "OPEN_CAMERA_RAW",
                "LibRaw integration",
                &format!(
                    "Open camera RAW source detected. LibRaw integration is required before direct ACES analysis is trusted. {}",
                    libraw.warnings.first().map(String::as_str).unwrap_or("LibRaw adapter status is unavailable.")
                ),
            )
        }
        Some("crm") | Some("rmf") => operator_proxy(
            source_path,
            "CANON_CINEMA_RAW",
            "Canon Cinema RAW Development",
            "Canon Cinema RAW sources need an operator-created analysis proxy until native decode is integrated.",
        ),
        Some("xocn") => operator_proxy(
            source_path,
            "SONY_XOCN",
            "Sony Catalyst Prepare / Catalyst Browse",
            "Sony X-OCN sources need an operator-created analysis proxy until native decode is integrated.",
        ),
        Some("mxf") => direct_original(
            source_path,
            "MXF",
            vec![
                "MXF can contain directly decodable video or camera RAW variants; metadata probing must confirm the source profile before analysis."
                    .to_string(),
            ],
        ),
        Some("mov") => direct_original(source_path, "QUICKTIME", Vec::new()),
        Some("mp4") => direct_original(source_path, "MP4", Vec::new()),
        _ => ProductionMediaCapabilityReport {
            source_path: source_path.to_string(),
            format_family: "UNKNOWN".to_string(),
            decode_path_kind: "unsupported_original".to_string(),
            direct_analysis_supported: false,
            vendor_decoder_required: false,
            proxy_required: true,
            recommended_proxy_tool: None,
            warnings: vec![
                "Unsupported source extension. Import a ProRes, DNxHR, H.264, H.265, or HEVC proxy for analysis."
                    .to_string(),
            ],
            decoder_status: None,
        },
    }
}

fn direct_original(
    source_path: &str,
    format_family: &str,
    warnings: Vec<String>,
) -> ProductionMediaCapabilityReport {
    ProductionMediaCapabilityReport {
        source_path: source_path.to_string(),
        format_family: format_family.to_string(),
        decode_path_kind: "direct_original".to_string(),
        direct_analysis_supported: true,
        vendor_decoder_required: false,
        proxy_required: false,
        recommended_proxy_tool: None,
        warnings,
        decoder_status: None,
    }
}

fn vendor_decoded(
    source_path: &str,
    format_family: &str,
    recommended_proxy_tool: &str,
) -> ProductionMediaCapabilityReport {
    ProductionMediaCapabilityReport {
        source_path: source_path.to_string(),
        format_family: format_family.to_string(),
        decode_path_kind: "vendor_decoded".to_string(),
        direct_analysis_supported: false,
        vendor_decoder_required: true,
        proxy_required: false,
        recommended_proxy_tool: Some(recommended_proxy_tool.to_string()),
        warnings: vec![
            "Original camera RAW source requires a vendor decode path before ACES analysis."
                .to_string(),
        ],
        decoder_status: None,
    }
}

fn native_candidate(
    source_path: &str,
    format_family: &str,
    recommended_proxy_tool: &str,
    warning: &str,
) -> ProductionMediaCapabilityReport {
    ProductionMediaCapabilityReport {
        source_path: source_path.to_string(),
        format_family: format_family.to_string(),
        decode_path_kind: "native_candidate".to_string(),
        direct_analysis_supported: false,
        vendor_decoder_required: false,
        proxy_required: true,
        recommended_proxy_tool: Some(recommended_proxy_tool.to_string()),
        warnings: vec![warning.to_string()],
        decoder_status: None,
    }
}

fn operator_proxy(
    source_path: &str,
    format_family: &str,
    recommended_proxy_tool: &str,
    warning: &str,
) -> ProductionMediaCapabilityReport {
    ProductionMediaCapabilityReport {
        source_path: source_path.to_string(),
        format_family: format_family.to_string(),
        decode_path_kind: "operator_proxy".to_string(),
        direct_analysis_supported: false,
        vendor_decoder_required: false,
        proxy_required: true,
        recommended_proxy_tool: Some(recommended_proxy_tool.to_string()),
        warnings: vec![warning.to_string()],
        decoder_status: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{classify_media_source, classify_media_source_with_libraw};
    use crate::production_libraw::LibRawAdapterReport;

    #[test]
    fn classifies_known_camera_sources() {
        assert_eq!(
            classify_media_source("/clip/A001.braw").format_family,
            "BLACKMAGIC_RAW"
        );
        assert_eq!(
            classify_media_source("/clip/A001.r3d").format_family,
            "RED_R3D"
        );
        assert_eq!(
            classify_media_source("/clip/A001.nev").format_family,
            "NIKON_NRAW"
        );
        assert_eq!(
            classify_media_source("/clip/A001.crm").format_family,
            "CANON_CINEMA_RAW"
        );
        assert_eq!(
            classify_media_source("/clip/A001.rmf").format_family,
            "CANON_CINEMA_RAW"
        );
        assert_eq!(classify_media_source("/clip/A001.mxf").format_family, "MXF");
        assert_eq!(
            classify_media_source("/clip/A001.mov").format_family,
            "QUICKTIME"
        );
        assert_eq!(classify_media_source("/clip/A001.mp4").format_family, "MP4");
    }

    #[test]
    fn marks_standard_containers_as_direct_analysis_sources() {
        for source in ["/clip/A001.mov", "/clip/A001.mp4", "/clip/A001.mxf"] {
            let report = classify_media_source(source);

            assert_eq!(report.decode_path_kind, "direct_original");
            assert!(report.direct_analysis_supported);
            assert!(!report.vendor_decoder_required);
            assert!(!report.proxy_required);
            assert!(report.recommended_proxy_tool.is_none());
        }
    }

    #[test]
    fn marks_vendor_decoded_raw_sources() {
        let braw = classify_media_source("/clip/A001.braw");
        assert_eq!(braw.decode_path_kind, "vendor_decoded");
        assert!(!braw.direct_analysis_supported);
        assert!(braw.vendor_decoder_required);
        assert!(!braw.proxy_required);
        assert_eq!(
            braw.recommended_proxy_tool.as_deref(),
            Some("Blackmagic RAW SDK / CineFlow BRAW bridge")
        );

        let r3d = classify_media_source("/clip/A001.r3d");
        assert_eq!(r3d.decode_path_kind, "vendor_decoded");
        assert!(r3d.vendor_decoder_required);
        assert_eq!(
            r3d.recommended_proxy_tool.as_deref(),
            Some("REDline / RED R3D SDK")
        );
    }

    #[test]
    fn marks_open_camera_raw_sources_as_native_candidates() {
        for source in [
            "/clip/A001.dng",
            "/clip/A001.arw",
            "/clip/A001.cr2",
            "/clip/A001.cr3",
            "/clip/A001.nef",
            "/clip/A001.raf",
            "/clip/A001.rw2",
            "/clip/A001.orf",
        ] {
            let report = classify_media_source(source);

            assert_eq!(report.format_family, "OPEN_CAMERA_RAW");
            assert_eq!(report.decode_path_kind, "native_candidate");
            assert!(!report.direct_analysis_supported);
            assert!(!report.vendor_decoder_required);
            assert!(report.proxy_required);
            assert_eq!(
                report.recommended_proxy_tool.as_deref(),
                Some("LibRaw integration")
            );
            assert!(report
                .warnings
                .iter()
                .any(|warning| warning.contains("LibRaw")));
            assert!(report
                .warnings
                .iter()
                .any(|warning| warning.contains("adapter")));
        }
    }

    #[test]
    fn marks_open_camera_raw_as_direct_when_libraw_frame_decode_is_available() {
        let libraw = LibRawAdapterReport {
            source_path: "/clip/A001.nef".to_string(),
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

        let report = classify_media_source_with_libraw("/clip/A001.nef", Some(libraw));

        assert_eq!(report.format_family, "OPEN_CAMERA_RAW");
        assert_eq!(report.decode_path_kind, "direct_original");
        assert!(report.direct_analysis_supported);
        assert!(!report.vendor_decoder_required);
        assert!(!report.proxy_required);
        assert!(report.recommended_proxy_tool.is_none());
    }

    #[test]
    fn marks_open_camera_raw_as_direct_with_nested_resource_libraw_bridge() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_media_cap_libraw_nested_{}",
            std::process::id()
        ));
        let resource_dir = root.join("Resources");
        let bin_dir = resource_dir.join("resources").join("bin");
        std::fs::create_dir_all(&bin_dir).expect("create nested libraw bin");
        std::fs::write(bin_dir.join("libraw_bridge"), "#!/bin/sh\n").expect("write fake bridge");

        let report = super::classify_media_source_from_environment_and_resources(
            "/clip/A001.nef",
            Some(&resource_dir),
        );

        assert_eq!(report.decode_path_kind, "direct_original");
        assert!(report.direct_analysis_supported);
        assert!(!report.proxy_required);

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn marks_operator_proxy_raw_sources() {
        for source in ["/clip/A001.crm", "/clip/A001.rmf", "/clip/A001.xocn"] {
            let report = classify_media_source(source);

            assert_eq!(report.decode_path_kind, "operator_proxy");
            assert!(!report.direct_analysis_supported);
            assert!(!report.vendor_decoder_required);
            assert!(report.proxy_required);
            assert!(report.recommended_proxy_tool.is_some());
            assert!(!report.warnings.is_empty());
        }
    }

    #[test]
    fn marks_unknown_sources_as_unsupported() {
        let report = classify_media_source("/clip/A001.xyz");

        assert_eq!(report.format_family, "UNKNOWN");
        assert_eq!(report.decode_path_kind, "unsupported_original");
        assert!(!report.direct_analysis_supported);
        assert!(!report.vendor_decoder_required);
        assert!(report.proxy_required);
        assert!(report.recommended_proxy_tool.is_none());
        assert!(!report.warnings.is_empty());
    }
}
