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
    if let Some(path) = std::env::var("CINEFLOW_OCIO_PROCESSOR")
        .ok()
        .filter(|value| !value.trim().is_empty())
    {
        return status_for_path(PathBuf::from(path), "environment");
    }

    if let Some(resource_dir) = resource_dir {
        for bundled_processor in [
            resource_dir
                .join("bin")
                .join(platform_executable_name("oiiotool")),
            resource_dir
                .join("resources")
                .join("bin")
                .join(platform_executable_name("oiiotool")),
            resource_dir
                .join("bin")
                .join(platform_executable_name("ocioconvert")),
            resource_dir
                .join("resources")
                .join("bin")
                .join(platform_executable_name("ocioconvert")),
        ] {
            if bundled_processor.is_file() {
                return status_for_path(bundled_processor, "bundled");
            }
        }
    }

    ProductionOcioProcessorStatus::unavailable(
        "No OCIO processor executable was found. Configure CINEFLOW_OCIO_PROCESSOR or bundle bin/oiiotool or bin/ocioconvert to enable pixel transforms.",
    )
}

fn status_for_path(path: PathBuf, source: &str) -> ProductionOcioProcessorStatus {
    if path.is_file() {
        return ProductionOcioProcessorStatus {
            processor_engine: format!("OpenColorIO processor ({source})"),
            processor_status: "processor_available".to_string(),
            executable_path: Some(path.to_string_lossy().to_string()),
            can_execute: true,
            warnings: Vec::new(),
        };
    }

    ProductionOcioProcessorStatus::unavailable(format!(
        "Configured OCIO processor does not exist or is not a file: {}",
        path.to_string_lossy()
    ))
}

fn platform_executable_name(name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::probe_ocio_processor;
    use std::fs;

    #[test]
    fn discovers_nested_tauri_resource_ocio_processor() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_ocio_processor_nested_{}",
            std::process::id()
        ));
        let resource_dir = root.join("Resources");
        let bin_dir = resource_dir.join("resources").join("bin");
        fs::create_dir_all(&bin_dir).expect("create nested processor bin dir");
        let processor = bin_dir.join("ocioconvert");
        fs::write(&processor, "#!/bin/sh\n").expect("write fake processor");

        let status = probe_ocio_processor(Some(&resource_dir));

        assert_eq!(status.processor_status, "processor_available");
        assert_eq!(
            status.executable_path.as_deref(),
            Some(processor.to_string_lossy().as_ref())
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn prefers_oiiotool_for_bundled_ocio_processor() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_ocio_processor_oiio_{}",
            std::process::id()
        ));
        let resource_dir = root.join("Resources");
        let bin_dir = resource_dir.join("resources").join("bin");
        fs::create_dir_all(&bin_dir).expect("create nested processor bin dir");
        fs::write(bin_dir.join("ocioconvert"), "#!/bin/sh\n").expect("write fake ocioconvert");
        let processor = bin_dir.join("oiiotool");
        fs::write(&processor, "#!/bin/sh\n").expect("write fake oiiotool");

        let status = probe_ocio_processor(Some(&resource_dir));

        assert_eq!(status.processor_status, "processor_available");
        assert_eq!(
            status.executable_path.as_deref(),
            Some(processor.to_string_lossy().as_ref())
        );

        let _ = fs::remove_dir_all(root);
    }
}
