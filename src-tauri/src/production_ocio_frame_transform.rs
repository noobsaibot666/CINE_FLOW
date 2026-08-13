use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductionOcioFrameTransformRequest {
    pub input_frame_path: PathBuf,
    pub output_frame_path: PathBuf,
    pub config_path: PathBuf,
    pub source_color_space: String,
    pub destination_color_space: String,
    pub processor_executable_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProductionOcioFrameTransformReport {
    pub transform_status: String,
    pub input_frame_path: String,
    pub output_frame_path: Option<String>,
    pub processor_executable_path: String,
    pub warning: Option<String>,
}

pub fn execute_ocio_frame_transform(
    request: &ProductionOcioFrameTransformRequest,
) -> ProductionOcioFrameTransformReport {
    if !request.input_frame_path.is_file() {
        return failed_report(
            request,
            format!(
                "OCIO input frame does not exist: {}",
                request.input_frame_path.display()
            ),
        );
    }

    if !request.config_path.is_file() {
        return failed_report(
            request,
            format!("OCIO config does not exist: {}", request.config_path.display()),
        );
    }

    if !request.processor_executable_path.is_file() {
        return failed_report(
            request,
            format!(
                "OCIO processor executable does not exist: {}",
                request.processor_executable_path.display()
            ),
        );
    }

    if let Some(parent) = request.output_frame_path.parent() {
        if let Err(error) = std::fs::create_dir_all(parent) {
            return failed_report(
                request,
                format!("Failed to create OCIO output directory: {error}"),
            );
        }
    }

    let output = crate::tools::create_command(&request.processor_executable_path.to_string_lossy())
        .arg("--config")
        .arg(&request.config_path)
        .arg("--source")
        .arg(&request.source_color_space)
        .arg("--destination")
        .arg(&request.destination_color_space)
        .arg("--input")
        .arg(&request.input_frame_path)
        .arg("--output")
        .arg(&request.output_frame_path)
        .stdout(Stdio::null())
        .output();

    match output {
        Ok(output) if output.status.success() && request.output_frame_path.is_file() => {
            ProductionOcioFrameTransformReport {
                transform_status: "transform_applied".to_string(),
                input_frame_path: request.input_frame_path.to_string_lossy().to_string(),
                output_frame_path: Some(request.output_frame_path.to_string_lossy().to_string()),
                processor_executable_path: request
                    .processor_executable_path
                    .to_string_lossy()
                    .to_string(),
                warning: None,
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let message = stderr
                .lines()
                .next()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .unwrap_or("OCIO processor failed or did not create an output frame");
            failed_report(request, message.to_string())
        }
        Err(error) => failed_report(request, format!("Failed to run OCIO processor: {error}")),
    }
}

fn failed_report(
    request: &ProductionOcioFrameTransformRequest,
    warning: String,
) -> ProductionOcioFrameTransformReport {
    ProductionOcioFrameTransformReport {
        transform_status: "transform_failed".to_string(),
        input_frame_path: request.input_frame_path.to_string_lossy().to_string(),
        output_frame_path: None,
        processor_executable_path: request
            .processor_executable_path
            .to_string_lossy()
            .to_string(),
        warning: Some(warning),
    }
}

#[cfg(test)]
mod tests {
    use super::{execute_ocio_frame_transform, ProductionOcioFrameTransformRequest};
    use std::fs;
    use std::path::Path;

    #[test]
    fn fake_processor_copy_marks_transform_applied() {
        let root = test_root("fake_processor_copy_marks_transform_applied");
        fs::create_dir_all(&root).expect("create test root");
        let input = root.join("input.jpg");
        let output = root.join("output.jpg");
        let config = root.join("config.ocio");
        let processor = root.join("fake-ocio.sh");
        fs::write(&input, b"fake-jpeg").expect("write input");
        fs::write(&config, "ocio_profile_version: 2").expect("write config");
        fs::write(
            &processor,
            "#!/bin/sh\nwhile [ $# -gt 0 ]; do\n  if [ \"$1\" = \"--input\" ]; then shift; input=\"$1\"; fi\n  if [ \"$1\" = \"--output\" ]; then shift; output=\"$1\"; fi\n  shift\ndone\ncp \"$input\" \"$output\"\n",
        )
        .expect("write fake processor");
        make_executable(&processor);

        let report = execute_ocio_frame_transform(&ProductionOcioFrameTransformRequest {
            input_frame_path: input.clone(),
            output_frame_path: output.clone(),
            config_path: config,
            source_color_space: "SONY_SLOG3_SGAMUT3_CINE".to_string(),
            destination_color_space: "ACEScct".to_string(),
            processor_executable_path: processor,
        });

        assert_eq!(report.transform_status, "transform_applied");
        assert_eq!(report.output_frame_path.as_deref(), Some(output.to_string_lossy().as_ref()));
        assert!(output.is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn failing_processor_returns_transform_failed() {
        let root = test_root("failing_processor_returns_transform_failed");
        fs::create_dir_all(&root).expect("create test root");
        let input = root.join("input.jpg");
        let output = root.join("output.jpg");
        let config = root.join("config.ocio");
        let processor = root.join("fake-ocio-fail.sh");
        fs::write(&input, b"fake-jpeg").expect("write input");
        fs::write(&config, "ocio_profile_version: 2").expect("write config");
        fs::write(&processor, "#!/bin/sh\necho transform refused >&2\nexit 7\n")
            .expect("write fake processor");
        make_executable(&processor);

        let report = execute_ocio_frame_transform(&ProductionOcioFrameTransformRequest {
            input_frame_path: input,
            output_frame_path: output,
            config_path: config,
            source_color_space: "SONY_SLOG3_SGAMUT3_CINE".to_string(),
            destination_color_space: "ACEScct".to_string(),
            processor_executable_path: processor,
        });

        assert_eq!(report.transform_status, "transform_failed");
        assert!(report.warning.as_deref().unwrap_or("").contains("transform refused"));
        assert!(report.output_frame_path.is_none());
        let _ = fs::remove_dir_all(root);
    }

    fn test_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!("cineflow_ocio_frame_{name}_{}", std::process::id()))
    }

    fn make_executable(path: &Path) {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(path).expect("metadata").permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(path, permissions).expect("set executable");
        }
    }
}
