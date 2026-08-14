use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const OPEN_CAMERA_RAW_EXTENSIONS: &[&str] = &[
    "dng", "arw", "cr2", "cr3", "nef", "nrw", "raf", "rw2", "orf", "srf", "sr2", "pef", "srw",
    "raw", "rwl", "iiq",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LibRawAdapterReport {
    pub source_path: String,
    pub adapter_id: String,
    pub support_tier: String,
    pub feature_enabled: bool,
    pub metadata_status: String,
    pub decode_status: String,
    pub metadata_available: bool,
    pub frame_decode_available: bool,
    pub proxy_required: bool,
    pub raw_format_family: Option<String>,
    pub decoder_family: Option<String>,
    pub warnings: Vec<String>,
}

pub fn inspect_libraw_adapter(source_path: &str) -> LibRawAdapterReport {
    let configured_bridge = std::env::var("CINEFLOW_LIBRAW_BRIDGE").ok();
    inspect_libraw_adapter_with_bridge_path(source_path, configured_bridge.as_deref())
}

pub fn inspect_libraw_adapter_from_environment_and_resources(
    source_path: &str,
    resource_dir: Option<&Path>,
) -> LibRawAdapterReport {
    let configured_bridge = std::env::var("CINEFLOW_LIBRAW_BRIDGE")
        .ok()
        .filter(|value| !value.trim().is_empty());

    let bridge_path = configured_bridge
        .map(PathBuf::from)
        .or_else(|| resource_dir.and_then(find_bundled_libraw_bridge));

    inspect_libraw_adapter_with_bridge_path(
        source_path,
        bridge_path
            .as_ref()
            .map(|path| path.to_string_lossy())
            .as_deref(),
    )
}

pub fn inspect_libraw_adapter_with_bridge_path(
    source_path: &str,
    bridge_path: Option<&str>,
) -> LibRawAdapterReport {
    let is_open_raw = is_open_camera_raw_extension(source_path);
    let feature_enabled = cfg!(feature = "libraw");

    if !is_open_raw {
        return LibRawAdapterReport {
            source_path: source_path.to_string(),
            adapter_id: "libraw_still".to_string(),
            support_tier: "unsupported".to_string(),
            feature_enabled,
            metadata_status: "unsupported_format".to_string(),
            decode_status: "unsupported_format".to_string(),
            metadata_available: false,
            frame_decode_available: false,
            proxy_required: true,
            raw_format_family: None,
            decoder_family: Some("LibRaw".to_string()),
            warnings: vec![
                "LibRaw adapter only handles open still/camera RAW candidates.".to_string(),
            ],
        };
    }

    if let Some(path) = bridge_path.filter(|value| !value.trim().is_empty()) {
        if Path::new(path).is_file() {
            return LibRawAdapterReport {
                source_path: source_path.to_string(),
                adapter_id: "libraw_still".to_string(),
                support_tier: "native_candidate".to_string(),
                feature_enabled,
                metadata_status: "metadata_available".to_string(),
                decode_status: "frame_decode_available".to_string(),
                metadata_available: true,
                frame_decode_available: true,
                proxy_required: false,
                raw_format_family: Some("OPEN_CAMERA_RAW".to_string()),
                decoder_family: Some("LibRaw bridge".to_string()),
                warnings: Vec::new(),
            };
        }

        return LibRawAdapterReport {
            source_path: source_path.to_string(),
            adapter_id: "libraw_still".to_string(),
            support_tier: "native_candidate".to_string(),
            feature_enabled,
            metadata_status: "bridge_missing".to_string(),
            decode_status: "bridge_missing".to_string(),
            metadata_available: false,
            frame_decode_available: false,
            proxy_required: true,
            raw_format_family: Some("OPEN_CAMERA_RAW".to_string()),
            decoder_family: Some("LibRaw bridge".to_string()),
            warnings: vec![format!(
                "Configured LibRaw bridge does not exist or is not a file: {path}"
            )],
        };
    }

    if feature_enabled {
        return LibRawAdapterReport {
            source_path: source_path.to_string(),
            adapter_id: "libraw_still".to_string(),
            support_tier: "native_candidate".to_string(),
            feature_enabled,
            metadata_status: "adapter_enabled".to_string(),
            decode_status: "decode_not_linked".to_string(),
            metadata_available: false,
            frame_decode_available: false,
            proxy_required: true,
            raw_format_family: Some("OPEN_CAMERA_RAW".to_string()),
            decoder_family: Some("LibRaw".to_string()),
            warnings: vec![
                "LibRaw adapter feature is enabled, but CINEFLOW_LIBRAW_BRIDGE is not configured yet."
                    .to_string(),
            ],
        };
    }

    LibRawAdapterReport {
        source_path: source_path.to_string(),
        adapter_id: "libraw_still".to_string(),
        support_tier: "native_candidate".to_string(),
        feature_enabled,
        metadata_status: "adapter_disabled".to_string(),
        decode_status: "adapter_disabled".to_string(),
        metadata_available: false,
        frame_decode_available: false,
        proxy_required: true,
        raw_format_family: Some("OPEN_CAMERA_RAW".to_string()),
        decoder_family: Some("LibRaw".to_string()),
        warnings: vec![
            "LibRaw adapter is not enabled in this build. Attach a camera-matched proxy before trusting analysis."
                .to_string(),
        ],
    }
}

pub fn is_open_camera_raw_extension(source_path: &str) -> bool {
    extension_lowercase(source_path)
        .as_deref()
        .is_some_and(|extension| OPEN_CAMERA_RAW_EXTENSIONS.contains(&extension))
}

fn find_bundled_libraw_bridge(resource_dir: &Path) -> Option<PathBuf> {
    [
        resource_dir.join("bin").join("libraw_bridge"),
        resource_dir
            .join("resources")
            .join("bin")
            .join("libraw_bridge"),
    ]
    .into_iter()
    .find(|path| path.is_file())
}

fn extension_lowercase(source_path: &str) -> Option<String> {
    Path::new(source_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::{
        inspect_libraw_adapter, inspect_libraw_adapter_from_environment_and_resources,
        inspect_libraw_adapter_with_bridge_path, is_open_camera_raw_extension,
    };
    use std::fs;

    #[test]
    fn recognizes_open_camera_raw_extensions() {
        for source in [
            "/camera/A001.dng",
            "/camera/A001.arw",
            "/camera/A001.cr2",
            "/camera/A001.cr3",
            "/camera/A001.nef",
            "/camera/A001.raf",
            "/camera/A001.rw2",
            "/camera/A001.orf",
            "/camera/A001.iiq",
        ] {
            assert!(
                is_open_camera_raw_extension(source),
                "expected {source} to be open RAW"
            );
        }
    }

    #[test]
    #[cfg(not(feature = "libraw"))]
    fn default_build_keeps_libraw_native_candidate_proxy_required() {
        let report = inspect_libraw_adapter("/camera/A001.nef");

        assert_eq!(report.adapter_id, "libraw_still");
        assert_eq!(report.support_tier, "native_candidate");
        assert_eq!(report.metadata_status, "adapter_disabled");
        assert_eq!(report.decode_status, "adapter_disabled");
        assert!(!report.feature_enabled);
        assert!(!report.metadata_available);
        assert!(!report.frame_decode_available);
        assert!(report.proxy_required);
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("LibRaw")));
    }

    #[test]
    fn missing_runtime_bridge_reports_bridge_missing() {
        let report = inspect_libraw_adapter_with_bridge_path(
            "/camera/A001.nef",
            Some("/definitely/missing/libraw-bridge"),
        );

        assert_eq!(report.metadata_status, "bridge_missing");
        assert_eq!(report.decode_status, "bridge_missing");
        assert!(!report.metadata_available);
        assert!(!report.frame_decode_available);
        assert!(report.proxy_required);
    }

    #[test]
    fn runtime_bridge_reports_metadata_and_frame_decode_available() {
        let root =
            std::env::temp_dir().join(format!("cineflow_libraw_bridge_{}", std::process::id()));
        fs::create_dir_all(&root).expect("create test root");
        let bridge = root.join("libraw-bridge");
        fs::write(&bridge, "fake bridge").expect("write bridge");

        let report = inspect_libraw_adapter_with_bridge_path(
            "/camera/A001.nef",
            Some(bridge.to_string_lossy().as_ref()),
        );

        assert_eq!(report.metadata_status, "metadata_available");
        assert_eq!(report.decode_status, "frame_decode_available");
        assert!(report.metadata_available);
        assert!(report.frame_decode_available);
        assert!(!report.proxy_required);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn nested_tauri_resource_bridge_reports_frame_decode_available() {
        let root = std::env::temp_dir().join(format!(
            "cineflow_libraw_nested_bridge_{}",
            std::process::id()
        ));
        let resource_dir = root.join("Resources");
        let bin_dir = resource_dir.join("resources").join("bin");
        fs::create_dir_all(&bin_dir).expect("create nested libraw bin dir");
        let bridge = bin_dir.join("libraw_bridge");
        fs::write(&bridge, "#!/bin/sh\n").expect("write fake bridge");

        let report = inspect_libraw_adapter_from_environment_and_resources(
            "/camera/A001.nef",
            Some(&resource_dir),
        );

        assert_eq!(report.decode_status, "frame_decode_available");
        assert!(report.frame_decode_available);
        assert!(!report.proxy_required);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    #[cfg(feature = "libraw")]
    fn feature_enabled_build_reports_decoder_bridge_not_linked_yet() {
        let report = inspect_libraw_adapter("/camera/A001.nef");

        assert_eq!(report.adapter_id, "libraw_still");
        assert_eq!(report.support_tier, "native_candidate");
        assert_eq!(report.metadata_status, "adapter_enabled");
        assert_eq!(report.decode_status, "decode_not_linked");
        assert!(report.feature_enabled);
        assert!(!report.metadata_available);
        assert!(!report.frame_decode_available);
        assert!(report.proxy_required);
    }
}
