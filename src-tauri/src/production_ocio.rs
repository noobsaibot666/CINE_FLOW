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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionOcioTransformExecutionReport {
    pub source_profile_id: String,
    pub analysis_color_space: String,
    pub transform_engine: String,
    pub config_source: String,
    pub config_path: Option<String>,
    pub config_status: String,
    pub transform_status: String,
    pub execution_status: String,
    pub processor_available: bool,
    pub metrics_trusted: bool,
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

pub fn build_ocio_transform_execution_report(
    source_profile_id: &str,
    analysis_color_space: &str,
    configured_path: Option<&str>,
) -> ProductionOcioTransformExecutionReport {
    let config_status =
        build_ocio_config_status(source_profile_id, analysis_color_space, configured_path);
    let processor_available = false;
    let mut warnings = config_status.warnings.clone();
    let execution_status = match config_status.config_status.as_str() {
        "unsupported_transform" => "unsupported_transform",
        "config_missing" => "config_missing",
        "metadata_only" => "metadata_only",
        "ocio_ready" if processor_available => "transform_applied",
        "ocio_ready" => {
            warnings.push(
                "OCIO config is available, but the native OCIO processor is not linked yet; pixel transforms are not executed."
                    .to_string(),
            );
            "processor_not_linked"
        }
        _ => "unavailable",
    };
    let metrics_trusted = processor_available && execution_status == "transform_applied";

    ProductionOcioTransformExecutionReport {
        source_profile_id: config_status.source_profile_id,
        analysis_color_space: config_status.analysis_color_space,
        transform_engine: config_status.transform_engine,
        config_source: config_status.config_source,
        config_path: config_status.config_path,
        config_status: config_status.config_status,
        transform_status: config_status.transform_status,
        execution_status: execution_status.to_string(),
        processor_available,
        metrics_trusted,
        warnings,
    }
}

pub fn build_ocio_transform_execution_report_from_environment(
    source_profile_id: &str,
    analysis_color_space: &str,
) -> ProductionOcioTransformExecutionReport {
    let configured_path = std::env::var("OCIO").ok();
    build_ocio_transform_execution_report(
        source_profile_id,
        analysis_color_space,
        configured_path.as_deref(),
    )
}

#[cfg(test)]
mod tests {
    use super::{build_ocio_config_status, build_ocio_transform_execution_report};

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

    #[test]
    fn reports_metadata_only_execution_without_processor() {
        let report =
            build_ocio_transform_execution_report("SONY_SLOG3_SGAMUT3_CINE", "ACEScct", None);

        assert_eq!(report.config_status, "metadata_only");
        assert_eq!(report.execution_status, "metadata_only");
        assert!(!report.processor_available);
        assert!(!report.metrics_trusted);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("not executed")));
    }

    #[test]
    fn missing_config_never_marks_metrics_trusted() {
        let report = build_ocio_transform_execution_report(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            Some("/definitely/missing/config.ocio"),
        );

        assert_eq!(report.config_status, "config_missing");
        assert_eq!(report.execution_status, "config_missing");
        assert!(!report.metrics_trusted);
    }

    #[test]
    fn unsupported_profile_never_marks_metrics_trusted() {
        let report =
            build_ocio_transform_execution_report("UNKNOWN_CAMERA_PROFILE", "ACEScct", None);

        assert_eq!(report.config_status, "unsupported_transform");
        assert_eq!(report.execution_status, "unsupported_transform");
        assert!(!report.metrics_trusted);
    }
}
