use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionOcioConfigStatus {
    pub source_profile_id: String,
    pub analysis_color_space: String,
    pub transform_engine: String,
    pub config_source: String,
    pub config_path: Option<String>,
    pub config_status: String,
    pub transform_status: String,
    pub configured: bool,
    pub loadable: bool,
    pub compatible: bool,
    pub warnings: Vec<String>,
}

pub fn build_ocio_config_status(
    source_profile_id: &str,
    analysis_color_space: &str,
    configured_path: Option<&str>,
) -> ProductionOcioConfigStatus {
    let transform_report =
        crate::production_color_pipeline::build_color_transform_report(source_profile_id);

    if transform_report.transform_status == "unsupported_source_profile" {
        return ProductionOcioConfigStatus {
            source_profile_id: source_profile_id.to_string(),
            analysis_color_space: analysis_color_space.to_string(),
            transform_engine: "OpenColorIO/ACES".to_string(),
            config_source: "none".to_string(),
            config_path: configured_path.map(str::to_string),
            config_status: "unsupported_transform".to_string(),
            transform_status: transform_report.transform_status,
            configured: configured_path.is_some(),
            loadable: false,
            compatible: false,
            warnings: transform_report.warnings,
        };
    }

    let Some(path) = configured_path.filter(|value| !value.trim().is_empty()) else {
        return ProductionOcioConfigStatus {
            source_profile_id: source_profile_id.to_string(),
            analysis_color_space: analysis_color_space.to_string(),
            transform_engine: "OpenColorIO/ACES".to_string(),
            config_source: "metadata".to_string(),
            config_path: None,
            config_status: "metadata_only".to_string(),
            transform_status: transform_report.transform_status,
            configured: false,
            loadable: false,
            compatible: true,
            warnings: vec![
                "OCIO config is not configured. CineFlow is using source-profile metadata only; pixel transforms are not executed yet."
                    .to_string(),
            ],
        };
    };

    if !Path::new(path).is_file() {
        return ProductionOcioConfigStatus {
            source_profile_id: source_profile_id.to_string(),
            analysis_color_space: analysis_color_space.to_string(),
            transform_engine: "OpenColorIO/ACES".to_string(),
            config_source: "environment".to_string(),
            config_path: Some(path.to_string()),
            config_status: "config_missing".to_string(),
            transform_status: "config_missing".to_string(),
            configured: true,
            loadable: false,
            compatible: false,
            warnings: vec![format!("OCIO config path does not exist or is not a file: {path}")],
        };
    }

    ProductionOcioConfigStatus {
        source_profile_id: source_profile_id.to_string(),
        analysis_color_space: analysis_color_space.to_string(),
        transform_engine: "OpenColorIO/ACES".to_string(),
        config_source: "environment".to_string(),
        config_path: Some(path.to_string()),
        config_status: "ocio_ready".to_string(),
        transform_status: transform_report.transform_status,
        configured: true,
        loadable: true,
        compatible: true,
        warnings: Vec::new(),
    }
}

pub fn build_ocio_config_status_from_environment(
    source_profile_id: &str,
    analysis_color_space: &str,
) -> ProductionOcioConfigStatus {
    let configured_path = std::env::var("OCIO").ok();
    build_ocio_config_status(
        source_profile_id,
        analysis_color_space,
        configured_path.as_deref(),
    )
}

#[cfg(test)]
mod tests {
    use super::build_ocio_config_status;

    #[test]
    fn reports_metadata_only_when_no_config_is_configured() {
        let report = build_ocio_config_status("SONY_SLOG3_SGAMUT3_CINE", "ACEScct", None);

        assert_eq!(report.config_status, "metadata_only");
        assert_eq!(report.transform_status, "metadata_ready");
        assert!(!report.configured);
        assert!(!report.loadable);
        assert!(report.compatible);
        assert!(report.warnings.iter().any(|warning| warning.contains("metadata")));
    }

    #[test]
    fn reports_missing_config_when_configured_path_does_not_exist() {
        let report = build_ocio_config_status(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            Some("/definitely/missing/config.ocio"),
        );

        assert_eq!(report.config_status, "config_missing");
        assert_eq!(report.transform_status, "config_missing");
        assert!(report.configured);
        assert!(!report.loadable);
        assert!(!report.compatible);
    }

    #[test]
    fn reports_unsupported_transform_for_unknown_source_profile() {
        let report = build_ocio_config_status("UNKNOWN_CAMERA_PROFILE", "ACEScct", None);

        assert_eq!(report.config_status, "unsupported_transform");
        assert_eq!(report.transform_status, "unsupported_source_profile");
        assert!(!report.compatible);
    }
}
