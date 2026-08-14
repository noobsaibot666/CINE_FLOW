use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionColorTransformReport {
    pub source_profile_id: String,
    pub analysis_space: String,
    pub transform_engine: String,
    pub transform_status: String,
    pub warnings: Vec<String>,
}

pub fn build_color_transform_report(source_profile_id: &str) -> ProductionColorTransformReport {
    match source_profile_id {
        "SONY_SLOG3_SGAMUT3_CINE"
        | "CANON_CLOG2_CINEMA_GAMUT"
        | "CANON_CLOG3_CINEMA_GAMUT"
        | "ARRI_LOGC3_WIDE_GAMUT"
        | "ARRI_LOGC4_WIDE_GAMUT4"
        | "RED_LOG3G10_RED_WIDE_GAMUT"
        | "BMD_FILM_GEN5_WIDE_GAMUT"
        | "PANASONIC_VLOG_VGAMUT" => ProductionColorTransformReport {
            source_profile_id: source_profile_id.to_string(),
            analysis_space: "ACEScg".to_string(),
            transform_engine: "OpenColorIO/ACES".to_string(),
            transform_status: "metadata_ready".to_string(),
            warnings: Vec::new(),
        },
        "REC709" => ProductionColorTransformReport {
            source_profile_id: source_profile_id.to_string(),
            analysis_space: "ACEScg".to_string(),
            transform_engine: "OpenColorIO/ACES".to_string(),
            transform_status: "display_referred_fallback".to_string(),
            warnings: vec![
                "Rec.709 is display-referred. Treat analysis as a fallback unless the original camera source profile is confirmed."
                    .to_string(),
            ],
        },
        _ => ProductionColorTransformReport {
            source_profile_id: source_profile_id.to_string(),
            analysis_space: "UNRESOLVED".to_string(),
            transform_engine: "unavailable".to_string(),
            transform_status: "unsupported_source_profile".to_string(),
            warnings: vec![
                "No ACES/OCIO transform metadata is registered for this source profile."
                    .to_string(),
            ],
        },
    }
}

#[cfg(test)]
mod tests {
    use super::build_color_transform_report;

    #[test]
    fn supported_source_profiles_return_aces_analysis_metadata() {
        for source_profile_id in [
            "SONY_SLOG3_SGAMUT3_CINE",
            "CANON_CLOG2_CINEMA_GAMUT",
            "CANON_CLOG3_CINEMA_GAMUT",
            "ARRI_LOGC3_WIDE_GAMUT",
            "ARRI_LOGC4_WIDE_GAMUT4",
            "RED_LOG3G10_RED_WIDE_GAMUT",
            "BMD_FILM_GEN5_WIDE_GAMUT",
            "PANASONIC_VLOG_VGAMUT",
        ] {
            let report = build_color_transform_report(source_profile_id);

            assert_eq!(report.source_profile_id, source_profile_id);
            assert_eq!(report.analysis_space, "ACEScg");
            assert_eq!(report.transform_engine, "OpenColorIO/ACES");
            assert_eq!(report.transform_status, "metadata_ready");
            assert!(report.warnings.is_empty());
        }
    }

    /// The UI offers these two source profiles (src/components/Production/sourceProfiles.ts),
    /// but the bundled ACES/OCIO config has no Fuji or Nikon input transform, and
    /// production_ocio_frame_transform.rs's ocio_color_space_name() has no mapping for them
    /// either. Treat them as unsupported until real IDTs are bundled, rather than reporting
    /// them as trusted while the pixel transform silently fails.
    #[test]
    fn fuji_and_nikon_profiles_are_not_treated_as_trusted_transforms_until_config_support_exists() {
        for source_profile_id in ["FUJI_FLOG2_FGAMUT", "NIKON_NLOG"] {
            let report = build_color_transform_report(source_profile_id);

            assert_eq!(report.transform_status, "unsupported_source_profile");
            assert!(!report.warnings.is_empty());
        }
    }

    #[test]
    fn rec709_is_marked_as_display_referred_fallback() {
        let report = build_color_transform_report("REC709");

        assert_eq!(report.analysis_space, "ACEScg");
        assert_eq!(report.transform_engine, "OpenColorIO/ACES");
        assert_eq!(report.transform_status, "display_referred_fallback");
        assert!(!report.warnings.is_empty());
    }

    #[test]
    fn unknown_profiles_are_not_treated_as_trusted_transforms() {
        let report = build_color_transform_report("UNKNOWN_VENDOR_PROFILE");

        assert_eq!(report.analysis_space, "UNRESOLVED");
        assert_eq!(report.transform_engine, "unavailable");
        assert_eq!(report.transform_status, "unsupported_source_profile");
        assert!(!report.warnings.is_empty());
    }
}
