use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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
    #[serde(default)]
    pub processor_status: String,
    #[serde(default)]
    pub processor_available: bool,
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProductionOcioConfigDiscovery {
    config_source: String,
    config_path: Option<String>,
}

pub fn build_ocio_config_status(
    source_profile_id: &str,
    analysis_color_space: &str,
    configured_path: Option<&str>,
) -> ProductionOcioConfigStatus {
    build_ocio_config_status_with_source(
        source_profile_id,
        analysis_color_space,
        "environment",
        configured_path,
    )
}

fn build_ocio_config_status_with_source(
    source_profile_id: &str,
    analysis_color_space: &str,
    config_source: &str,
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
            processor_status: "processor_not_available".to_string(),
            processor_available: false,
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
            processor_status: "processor_not_available".to_string(),
            processor_available: false,
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
            config_source: config_source.to_string(),
            config_path: Some(path.to_string()),
            config_status: "config_missing".to_string(),
            transform_status: "config_missing".to_string(),
            configured: true,
            loadable: false,
            compatible: false,
            processor_status: "processor_not_available".to_string(),
            processor_available: false,
            warnings: vec![format!(
                "OCIO config path does not exist or is not a file: {path}"
            )],
        };
    }

    ProductionOcioConfigStatus {
        source_profile_id: source_profile_id.to_string(),
        analysis_color_space: analysis_color_space.to_string(),
        transform_engine: "OpenColorIO/ACES".to_string(),
        config_source: config_source.to_string(),
        config_path: Some(path.to_string()),
        config_status: "ocio_ready".to_string(),
        transform_status: transform_report.transform_status,
        configured: true,
        loadable: true,
        compatible: true,
        processor_status: "processor_not_available".to_string(),
        processor_available: false,
        warnings: Vec::new(),
    }
}

fn discover_ocio_config_path(
    environment_path: Option<&str>,
    resource_dir: Option<&Path>,
) -> ProductionOcioConfigDiscovery {
    if let Some(path) = environment_path.filter(|value| !value.trim().is_empty()) {
        return ProductionOcioConfigDiscovery {
            config_source: "environment".to_string(),
            config_path: Some(path.to_string()),
        };
    }

    if let Some(path) = resource_dir.and_then(find_bundled_ocio_config) {
        return ProductionOcioConfigDiscovery {
            config_source: "bundled".to_string(),
            config_path: Some(path.to_string_lossy().to_string()),
        };
    }

    ProductionOcioConfigDiscovery {
        config_source: "metadata".to_string(),
        config_path: None,
    }
}

fn find_bundled_ocio_config(resource_dir: &Path) -> Option<PathBuf> {
    [
        resource_dir.join("ocio").join("config.ocio"),
        resource_dir.join("aces").join("config.ocio"),
        resource_dir.join("config.ocio"),
    ]
    .into_iter()
    .find(|path| path.is_file())
}

pub fn build_ocio_config_status_from_discovery(
    source_profile_id: &str,
    analysis_color_space: &str,
    environment_path: Option<&str>,
    resource_dir: Option<&Path>,
) -> ProductionOcioConfigStatus {
    let discovery = discover_ocio_config_path(environment_path, resource_dir);
    let mut status = build_ocio_config_status_with_source(
        source_profile_id,
        analysis_color_space,
        &discovery.config_source,
        discovery.config_path.as_deref(),
    );
    let processor_status = crate::production_ocio_processor::probe_ocio_processor(resource_dir);
    status.processor_status = processor_status.processor_status;
    status.processor_available = processor_status.can_execute;
    status.warnings.extend(processor_status.warnings);
    status
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

pub fn build_ocio_config_status_from_environment_and_resources(
    source_profile_id: &str,
    analysis_color_space: &str,
    resource_dir: Option<&Path>,
) -> ProductionOcioConfigStatus {
    let configured_path = std::env::var("OCIO").ok();
    build_ocio_config_status_from_discovery(
        source_profile_id,
        analysis_color_space,
        configured_path.as_deref(),
        resource_dir,
    )
}

pub fn build_ocio_transform_execution_report(
    source_profile_id: &str,
    analysis_color_space: &str,
    configured_path: Option<&str>,
) -> ProductionOcioTransformExecutionReport {
    let config_status =
        build_ocio_config_status(source_profile_id, analysis_color_space, configured_path);
    let processor_status = crate::production_ocio_processor::probe_ocio_processor(None);
    build_ocio_transform_execution_report_from_config_status(config_status, processor_status)
}

pub fn build_ocio_transform_execution_report_from_discovery(
    source_profile_id: &str,
    analysis_color_space: &str,
    environment_path: Option<&str>,
    resource_dir: Option<&Path>,
) -> ProductionOcioTransformExecutionReport {
    let config_status = build_ocio_config_status_from_discovery(
        source_profile_id,
        analysis_color_space,
        environment_path,
        resource_dir,
    );
    let processor_status = crate::production_ocio_processor::probe_ocio_processor(resource_dir);
    build_ocio_transform_execution_report_from_config_status(config_status, processor_status)
}

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

fn build_ocio_transform_execution_report_from_config_status(
    config_status: ProductionOcioConfigStatus,
    processor_status: crate::production_ocio_processor::ProductionOcioProcessorStatus,
) -> ProductionOcioTransformExecutionReport {
    let processor_available = processor_status.can_execute;
    let mut warnings = config_status.warnings.clone();
    warnings.extend(processor_status.warnings);
    let execution_status = match config_status.config_status.as_str() {
        "unsupported_transform" => "unsupported_transform",
        "config_missing" => "config_missing",
        "metadata_only" => "metadata_only",
        "ocio_ready" if processor_available => "processor_ready",
        "ocio_ready" => {
            warnings.push(
                "OCIO config is available, but an OCIO processor executable is not available yet; pixel transforms are not executed."
                    .to_string(),
            );
            "processor_not_available"
        }
        _ => "unavailable",
    };
    let metrics_trusted = execution_status == "transform_applied";

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

pub fn build_ocio_transform_execution_report_from_environment_and_resources(
    source_profile_id: &str,
    analysis_color_space: &str,
    resource_dir: Option<&Path>,
) -> ProductionOcioTransformExecutionReport {
    let configured_path = std::env::var("OCIO").ok();
    build_ocio_transform_execution_report_from_discovery(
        source_profile_id,
        analysis_color_space,
        configured_path.as_deref(),
        resource_dir,
    )
}

#[cfg(test)]
mod tests {
    use super::{
        build_ocio_config_status, build_ocio_config_status_from_discovery,
        build_ocio_transform_execution_report,
        build_ocio_transform_execution_report_from_discovery,
        build_ocio_transform_execution_report_from_discovery_and_processor,
    };
    use crate::production_ocio_processor::ProductionOcioProcessorStatus;
    use std::fs;

    #[test]
    fn reports_metadata_only_when_no_config_is_configured() {
        let report = build_ocio_config_status("SONY_SLOG3_SGAMUT3_CINE", "ACEScct", None);

        assert_eq!(report.config_status, "metadata_only");
        assert_eq!(report.transform_status, "metadata_ready");
        assert!(!report.configured);
        assert!(!report.loadable);
        assert!(report.compatible);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("metadata")));
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
    fn discovers_environment_ocio_config_before_bundled_config() {
        let root = std::env::temp_dir().join(format!("cineflow_ocio_env_{}", std::process::id()));
        let bundled_dir = root.join("Resources").join("ocio");
        fs::create_dir_all(&bundled_dir).expect("create bundled ocio dir");
        let bundled_config = bundled_dir.join("config.ocio");
        let env_config = root.join("env_config.ocio");
        fs::write(&bundled_config, "ocio_profile_version: 2").expect("write bundled config");
        fs::write(&env_config, "ocio_profile_version: 2").expect("write env config");

        let report = build_ocio_config_status_from_discovery(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            Some(env_config.to_string_lossy().as_ref()),
            Some(&root.join("Resources")),
        );

        assert_eq!(report.config_source, "environment");
        assert_eq!(report.config_status, "ocio_ready");
        assert_eq!(
            report.config_path.as_deref(),
            Some(env_config.to_string_lossy().as_ref())
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn discovers_bundled_ocio_config_when_environment_is_empty() {
        let root =
            std::env::temp_dir().join(format!("cineflow_ocio_bundled_{}", std::process::id()));
        let bundled_dir = root.join("Resources").join("ocio");
        fs::create_dir_all(&bundled_dir).expect("create bundled ocio dir");
        let bundled_config = bundled_dir.join("config.ocio");
        fs::write(&bundled_config, "ocio_profile_version: 2").expect("write bundled config");

        let report = build_ocio_config_status_from_discovery(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            None,
            Some(&root.join("Resources")),
        );

        assert_eq!(report.config_source, "bundled");
        assert_eq!(report.config_status, "ocio_ready");
        assert_eq!(
            report.config_path.as_deref(),
            Some(bundled_config.to_string_lossy().as_ref())
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn config_status_reports_processor_readiness_separately() {
        let report = build_ocio_config_status("SONY_SLOG3_SGAMUT3_CINE", "ACEScct", None);

        assert_eq!(report.processor_status, "processor_not_available");
        assert!(!report.processor_available);
    }

    #[test]
    fn explicit_missing_environment_config_does_not_fall_back_to_bundled() {
        let root =
            std::env::temp_dir().join(format!("cineflow_ocio_missing_env_{}", std::process::id()));
        let bundled_dir = root.join("Resources").join("ocio");
        fs::create_dir_all(&bundled_dir).expect("create bundled ocio dir");
        fs::write(bundled_dir.join("config.ocio"), "ocio_profile_version: 2")
            .expect("write bundled config");
        let missing_env_config = root.join("missing_config.ocio");

        let report = build_ocio_config_status_from_discovery(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            Some(missing_env_config.to_string_lossy().as_ref()),
            Some(&root.join("Resources")),
        );

        assert_eq!(report.config_source, "environment");
        assert_eq!(report.config_status, "config_missing");
        assert_eq!(
            report.config_path.as_deref(),
            Some(missing_env_config.to_string_lossy().as_ref())
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn bundled_ready_config_reports_processor_not_available_until_ocio_runtime_exists() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_ocio_transform_bundled_{}",
            std::process::id()
        ));
        let bundled_dir = root.join("Resources").join("ocio");
        fs::create_dir_all(&bundled_dir).expect("create bundled ocio dir");
        fs::write(bundled_dir.join("config.ocio"), "ocio_profile_version: 2")
            .expect("write bundled config");

        let report = build_ocio_transform_execution_report_from_discovery(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            None,
            Some(&root.join("Resources")),
        );

        assert_eq!(report.config_source, "bundled");
        assert_eq!(report.config_status, "ocio_ready");
        assert_eq!(report.execution_status, "processor_not_available");
        assert!(!report.metrics_trusted);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn ready_config_with_processor_reports_processor_ready_not_trusted_until_frame_transform() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_ocio_transform_processor_{}",
            std::process::id()
        ));
        let bundled_dir = root.join("Resources").join("ocio");
        fs::create_dir_all(&bundled_dir).expect("create bundled ocio dir");
        fs::write(bundled_dir.join("config.ocio"), "ocio_profile_version: 2")
            .expect("write bundled config");

        let report = build_ocio_transform_execution_report_from_discovery_and_processor(
            "SONY_SLOG3_SGAMUT3_CINE",
            "ACEScct",
            None,
            Some(&root.join("Resources")),
            ProductionOcioProcessorStatus::available_for_test("/usr/local/bin/ocioconvert"),
        );

        assert_eq!(report.config_source, "bundled");
        assert_eq!(report.config_status, "ocio_ready");
        assert_eq!(report.execution_status, "processor_ready");
        assert!(report.processor_available);
        assert!(!report.metrics_trusted);
        let _ = fs::remove_dir_all(root);
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
