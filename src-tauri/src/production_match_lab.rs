use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Duration;
use crate::production_calibration::CalibrationChartDetection;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CameraMatchRgbMedians {
    pub red: f64,
    pub green: f64,
    pub blue: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CameraMatchFrameMetrics {
    pub frame_index: u32,
    pub timestamp_ms: u64,
    pub frame_path: String,
    pub extraction_strategy: Option<String>,
    pub width: u32,
    pub height: u32,
    pub luma_histogram: Vec<u32>,
    pub rgb_medians: CameraMatchRgbMedians,
    #[serde(default)]
    pub midtone_rgb_medians: CameraMatchRgbMedians,
    #[serde(default)]
    pub skin_rgb_medians: CameraMatchRgbMedians,
    pub luma_median: f64,
    #[serde(default)]
    pub midtone_luma_median: f64,
    #[serde(default)]
    pub skin_luma_median: f64,
    pub highlight_percent: f64,
    pub midtone_density: f64,
    #[serde(default)]
    pub shadow_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CameraMatchAggregateMetrics {
    pub luma_histogram: Vec<f64>,
    pub rgb_medians: CameraMatchRgbMedians,
    #[serde(default)]
    pub midtone_rgb_medians: CameraMatchRgbMedians,
    #[serde(default)]
    pub skin_rgb_medians: CameraMatchRgbMedians,
    pub luma_median: f64,
    #[serde(default)]
    pub midtone_luma_median: f64,
    #[serde(default)]
    pub skin_luma_median: f64,
    pub highlight_percent: f64,
    pub midtone_density: f64,
    #[serde(default)]
    pub shadow_percent: f64,
    pub luma_variance: f64,
    pub red_variance: f64,
    pub green_variance: f64,
    pub blue_variance: f64,
    pub highlight_variance: f64,
    pub midtone_variance: f64,
    #[serde(default)]
    pub shadow_variance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MeasurementWaveformSummary {
    pub median_luma: f64,
    #[serde(default)]
    pub midtone_band_median_luma: Option<f64>,
    #[serde(default)]
    pub skin_band_median_luma: Option<f64>,
    pub top_band_density: f64,
    pub bottom_band_density: f64,
    pub skin_band_estimate: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MeasurementFalseColorSummary {
    pub clipped: f64,
    pub near_clip: f64,
    pub skin_zone: f64,
    pub mids: f64,
    pub shadows: f64,
    pub crushed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MeasurementRgbBalanceSummary {
    pub red_vs_green: f64,
    pub blue_vs_green: f64,
    #[serde(default)]
    pub midtone_red_vs_green: Option<f64>,
    #[serde(default)]
    pub midtone_blue_vs_green: Option<f64>,
    #[serde(default)]
    pub skin_red_vs_green: Option<f64>,
    #[serde(default)]
    pub skin_blue_vs_green: Option<f64>,
    pub green_magenta_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MeasurementLumaSummary {
    pub min_luma: f64,
    pub max_luma: f64,
    pub median_luma: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductionMeasurementBundle {
    pub source_path: String,
    pub original_format_kind: Option<String>,
    pub analysis_source_kind: Option<String>,
    pub codec_name: Option<String>,
    pub resolution: Option<String>,
    pub fps: Option<f64>,
    pub iso_metadata: Option<String>,
    pub wb_metadata: Option<String>,
    pub waveform_summary: MeasurementWaveformSummary,
    pub false_color_summary: MeasurementFalseColorSummary,
    pub rgb_balance_summary: MeasurementRgbBalanceSummary,
    pub luma_summary: MeasurementLumaSummary,
    pub highlight_percentage: f64,
    pub midtone_percentage: f64,
    pub shadow_percentage: f64,
    pub calibration_available: Option<bool>,
    pub calibration_quality: Option<String>,
    pub calibration_neutral_bias: Option<String>,
    pub calibration_mean_delta_e: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraMatchAnalysisResult {
    pub source_path: String,
    #[serde(default)]
    pub source_kind: Option<String>,
    #[serde(default)]
    pub original_format_kind: Option<String>,
    #[serde(default)]
    pub decode_path_kind: Option<String>,
    #[serde(default)]
    pub decode_source_path: Option<String>,
    pub clip_path: String,
    pub clip_name: String,
    pub representative_frame_path: String,
    pub frame_paths: Vec<String>,
    pub per_frame: Vec<CameraMatchFrameMetrics>,
    pub aggregate: CameraMatchAggregateMetrics,
    #[serde(default)]
    pub proxy_info: Option<String>,
    #[serde(default)]
    pub proxy_validation: Option<ProductionProxyValidationReport>,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub measurement_bundle: ProductionMeasurementBundle,
    #[serde(default)]
    pub source_profile_id: Option<String>,
    #[serde(default)]
    pub analysis_color_space: Option<String>,
    #[serde(default)]
    pub color_transform_status: Option<String>,
    #[serde(default)]
    pub color_transform_engine: Option<String>,
    #[serde(default)]
    pub ocio_config_status: Option<String>,
    #[serde(default)]
    pub ocio_config_source: Option<String>,
    #[serde(default)]
    pub ocio_config_path: Option<String>,
    #[serde(default)]
    pub transform_path_kind: Option<String>,
    #[serde(default)]
    pub ocio_processor_path: Option<String>,
    #[serde(default)]
    pub trust_fallback_reason: Option<String>,
    #[serde(default)]
    pub metrics_trusted: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMatchLabProxyResult {
    pub proxy_path: String,
    pub reused_proxy: bool,
    pub decoder_path: Option<String>,
    pub strategy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductionProxyValidationReport {
    pub source_path: String,
    pub proxy_path: String,
    pub validation_status: String,
    pub source_duration_ms: Option<u64>,
    pub proxy_duration_ms: Option<u64>,
    pub source_frame_count_estimate: Option<u64>,
    pub proxy_frame_count_estimate: Option<u64>,
    pub source_resolution: Option<String>,
    pub proxy_resolution: Option<String>,
    pub proxy_codec: Option<String>,
    pub source_pairing: String,
    pub color_pipeline_note: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMatchLabRunResultInput {
    pub slot: String,
    pub proxy_path: Option<String>,
    pub analysis: CameraMatchAnalysisResult,
    pub calibration: Option<CalibrationChartDetection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMatchLabRunSummary {
    pub run_id: String,
    pub project_id: String,
    pub hero_slot: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMatchLabRunResult {
    pub slot: String,
    pub proxy_path: Option<String>,
    pub representative_frame_path: String,
    pub frame_paths: Vec<String>,
    pub analysis: CameraMatchAnalysisResult,
    pub calibration: Option<CalibrationChartDetection>,
    #[serde(default)]
    pub capability_json: Option<String>,
    #[serde(default)]
    pub source_profile_id: Option<String>,
    #[serde(default)]
    pub analysis_color_space: Option<String>,
    #[serde(default)]
    pub decode_path_kind: Option<String>,
    #[serde(default)]
    pub confidence_score: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMatchLabRun {
    pub run_id: String,
    pub project_id: String,
    pub hero_slot: String,
    pub created_at: String,
    pub results: Vec<ProductionMatchLabRunResult>,
}

#[derive(Debug, Clone, Copy)]
pub struct ProductionMatchConfidenceInput<'a> {
    pub decode_path_kind: Option<&'a str>,
    pub source_profile_id: Option<&'a str>,
    pub color_transform_status: Option<&'a str>,
    pub metrics_trusted: Option<bool>,
    pub proxy_validation_status: Option<&'a str>,
    pub proxy_warning_count: usize,
    pub chart_detected: Option<bool>,
    pub calibration_quality_score: Option<f64>,
    pub clipped_patch_count: u32,
    pub frame_count: usize,
}

pub fn compute_production_match_confidence(input: &ProductionMatchConfidenceInput<'_>) -> u8 {
    let mut score: i32 = 96;

    match input.decode_path_kind {
        Some("direct_original") | Some("vendor_decoded") => {}
        Some("operator_proxy") => score -= 22,
        Some("unsupported_original") => score -= 52,
        Some(_) => score -= 18,
        None => score -= 12,
    }

    if input.source_profile_id.is_none() {
        score -= 14;
    }

    match input.color_transform_status {
        Some("transform_applied") => {}
        Some("metadata_only") | Some("processor_not_available") => score -= 14,
        Some("processor_ready") => score -= 10,
        Some("transform_failed") => score -= 18,
        Some("config_missing") | Some("unsupported_transform") => score -= 22,
        Some(_) => score -= 8,
        None => score -= 10,
    }

    match input.metrics_trusted {
        Some(true) => {}
        Some(false) => score -= 12,
        None => score -= 8,
    }

    match input.proxy_validation_status {
        Some("validated") => {}
        Some("warnings") => score -= 8,
        Some(_) => score -= 6,
        None => {}
    }
    score -= (input.proxy_warning_count.min(3) as i32) * 4;

    match input.chart_detected {
        Some(true) => {}
        // A chart in frame that could not be read is a real problem; simply not
        // shooting a chart is a legitimate field workflow and penalised less.
        Some(false) => score -= 28,
        None => score -= 10,
    }

    if let Some(quality) = input.calibration_quality_score {
        if quality < 0.4 {
            score -= 24;
        } else if quality < 0.65 {
            score -= 14;
        } else if quality < 0.85 {
            score -= 6;
        }
    }

    score -= (input.clipped_patch_count.min(6) as i32) * 4;

    if input.frame_count <= 1 {
        score -= 18;
    } else if input.frame_count < 5 {
        score -= 8;
    }

    // Evidence floor: a chartless result is still trustworthy when every other
    // pillar is solid — original decode, an applied color transform, trusted
    // metrics, no clipped patches, and a healthy frame sample. Don't let the
    // chart-absent penalty alone drag that case below "trustworthy".
    let strongly_corroborated = matches!(
        input.decode_path_kind,
        Some("direct_original") | Some("vendor_decoded")
    ) && input.color_transform_status == Some("transform_applied")
        && input.metrics_trusted == Some(true)
        && input.clipped_patch_count == 0
        && input.frame_count >= 8;
    if strongly_corroborated {
        score = score.max(78);
    }

    score.clamp(0, 100) as u8
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BrawDecoderCaps {
    pub found: bool,
    pub executable_path: Option<String>,
    /// Directory to set as cwd when spawning the decoder so it can find
    /// ./Libraries/BlackmagicRawAPI.framework/ at a relative path.
    pub working_dir: Option<String>,
    pub supports_stdout: bool,
    pub supports_output_flag: bool,
    pub help_excerpt: String,
    pub version: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MatchLabProxyAttempt {
    pub job_id: String,
    pub running: bool,
    pub last_failed_at_ms: Option<i64>,
}

#[derive(Default)]
pub struct MatchLabProxyTracker {
    pub attempts: Mutex<HashMap<String, MatchLabProxyAttempt>>,
}

#[derive(Default)]
pub struct MatchLabAnalysisTracker {
    pub running: Mutex<HashMap<String, String>>,
}

pub fn build_cache_dir(
    cache_root: &str,
    project_id: &str,
    camera_slot: &str,
    clip_path: &str,
) -> PathBuf {
    Path::new(cache_root)
        .join("production")
        .join("cache")
        .join("match_lab")
        .join(project_id)
        .join(camera_slot)
        .join(hash_string(clip_path))
}

pub fn build_proxy_dir(
    cache_root: &str,
    project_id: &str,
    camera_slot: &str,
    clip_path: &str,
) -> PathBuf {
    Path::new(cache_root)
        .join("production")
        .join("cache")
        .join("match_lab")
        .join(project_id)
        .join(camera_slot)
        .join("proxy")
        .join(hash_source_signature(clip_path))
}

pub fn build_proxy_paths(
    cache_root: &str,
    project_id: &str,
    camera_slot: &str,
    clip_path: &str,
) -> (PathBuf, PathBuf, PathBuf) {
    let root = build_proxy_dir(cache_root, project_id, camera_slot, clip_path);
    let final_path = root.join("proxy.mp4");
    let tmp_path = root.join("proxy.tmp.mp4");
    (root, final_path, tmp_path)
}

pub fn build_proxy_decode_path(root: &Path) -> PathBuf {
    root.join("decoded.tmp.mov")
}

pub fn clip_name_from_path(clip_path: &str) -> String {
    Path::new(clip_path)
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| clip_path.to_string())
}

pub fn is_braw_path(clip_path: &str) -> bool {
    Path::new(clip_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("braw"))
        .unwrap_or(false)
}

fn lower_ext(clip_path: &str) -> String {
    Path::new(clip_path)
        .extension()
        .and_then(|v| v.to_str())
        .map(|v| v.to_ascii_lowercase())
        .unwrap_or_default()
}

/// RED family (R3D / R3D NE / Nikon N-RAW) — decoded with REDline / the RED SDK.
pub fn is_redline_backed_path(clip_path: &str) -> bool {
    matches!(lower_ext(clip_path).as_str(), "r3d" | "nev")
}

/// Formats with no bundled decoder that DaVinci Resolve can decode headless:
/// Canon CRM/RMF, Sony X-OCN, and single-frame ARRIRAW (.ari/.arx). ARRIRAW
/// wrapped in MXF is handled separately — see `is_arri_mxf_container_path`.
pub fn is_resolve_backed_path(clip_path: &str) -> bool {
    matches!(lower_ext(clip_path).as_str(), "crm" | "rmf" | "xocn" | "ari" | "arx")
}

/// `.mxf` — usually a directly decodable container (ProRes / XAVC / DNxHD) but
/// also the wrapper for ARRIRAW, which ffmpeg cannot read. We only route it
/// through Resolve / ARRI ART when direct frame extraction has failed, so the
/// operator gets a "Generate proxy" path instead of a dead end.
pub fn is_arri_mxf_container_path(clip_path: &str) -> bool {
    lower_ext(clip_path) == "mxf"
}

/// Single-frame / stream ARRIRAW. Decoded by ARRI's `art-cmd` or DaVinci Resolve.
pub fn is_arriraw_path(clip_path: &str) -> bool {
    matches!(lower_ext(clip_path).as_str(), "ari" | "arx")
}

/// Any camera-RAW source that needs a decode provider before analysis.
pub fn is_decoder_backed_raw_path(clip_path: &str) -> bool {
    is_braw_path(clip_path) || is_redline_backed_path(clip_path) || is_resolve_backed_path(clip_path)
}

/// Locate a REDline / RED-SDK CLI. `red_sdk_dir` is a user-configured install
/// folder (see `production_decoder_status`).
///
/// Preference order matters on Apple Silicon: the sidecar CineFlow bundles is an
/// older x86_64 REDline that only runs under Rosetta. A REDline from a current
/// REDCINE-X PRO / standalone REDline install is a native arm64 build and is far
/// faster, so it wins over the bundled copy.
pub fn locate_redline(red_sdk_dir: Option<&str>) -> Option<String> {
    // 1. Operator-configured RED SDK / REDCINE-X install directory.
    if let Some(dir) = red_sdk_dir {
        for name in ["REDline", "redline", "REDLine", "REDline.exe"] {
            for sub in [
                "",
                "bin",
                "Contents/MacOS",
                "Redistributable",
                "Redistributable/mac",
                "Redistributable/win",
                "Redistributable/linux",
            ] {
                let candidate = if sub.is_empty() {
                    Path::new(dir).join(name)
                } else {
                    Path::new(dir).join(sub).join(name)
                };
                if candidate.exists() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }
    }

    // 2. A native REDline dropped by REDCINE-X PRO or the standalone installer.
    #[cfg(target_os = "macos")]
    for path in [
        "/Applications/REDCINE-X PRO.app/Contents/MacOS/REDline",
        "/Applications/REDCINEX PRO.app/Contents/MacOS/REDline",
        "/Applications/REDCINE-X Professional/REDCINE-X PRO.app/Contents/MacOS/REDline",
        "/Applications/REDCINE-X Professional/REDCINEX PRO.app/Contents/MacOS/REDline",
        "/usr/local/bin/REDline",
        "/opt/homebrew/bin/REDline",
    ] {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    // 3. PATH.
    #[cfg(not(target_os = "windows"))]
    if let Ok(out) = std::process::Command::new("which").arg("REDline").output() {
        if out.status.success() {
            let found = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !found.is_empty() && Path::new(&found).exists() {
                return Some(found);
            }
        }
    }

    // 4. Bundled sidecar (last resort — may be x86_64 under Rosetta).
    for name in ["red_bridge", "REDline", "redline"] {
        let path = crate::tools::find_executable(name);
        if path != name && Path::new(&path).exists() {
            return Some(path);
        }
    }
    None
}

/// Locate ARRI's `art-cmd` CLI (part of the free ARRI Reference Tool). Mirrors
/// `locate_redline`: an operator-configured install dir / app / binary first,
/// then the standard install locations, then PATH.
pub fn locate_art_cmd(art_cmd_dir: Option<&str>) -> Option<String> {
    let names: &[&str] = &["art-cmd", "art_cmd", "ART-CMD", "art-cmd.exe"];

    // 1. Operator-configured location — a folder, an app bundle, or the binary.
    if let Some(dir) = art_cmd_dir {
        let p = Path::new(dir);
        if p.is_file() {
            return Some(dir.to_string());
        }
        for name in names {
            for sub in [
                "",
                "bin",
                "Contents/MacOS",
                "Contents/Resources",
                "Contents/Resources/bin",
            ] {
                let candidate = if sub.is_empty() {
                    p.join(name)
                } else {
                    p.join(sub).join(name)
                };
                if candidate.exists() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }
    }

    // 2. Standard install locations.
    #[cfg(target_os = "macos")]
    for path in [
        "/Applications/ARRI Reference Tool.app/Contents/MacOS/art-cmd",
        "/Applications/ARRI/ARRI Reference Tool.app/Contents/MacOS/art-cmd",
        "/Applications/ARRI Reference Tool CMD/art-cmd",
        "/usr/local/bin/art-cmd",
        "/opt/homebrew/bin/art-cmd",
    ] {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    #[cfg(target_os = "windows")]
    for path in [
        "C:\\Program Files\\ARRI\\ARRI Reference Tool\\art-cmd.exe",
        "C:\\Program Files\\ARRI Reference Tool\\art-cmd.exe",
    ] {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    // 3. PATH.
    #[cfg(not(target_os = "windows"))]
    if let Ok(out) = std::process::Command::new("which").arg("art-cmd").output() {
        if out.status.success() {
            let found = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !found.is_empty() && Path::new(&found).exists() {
                return Some(found);
            }
        }
    }

    None
}

/// Decode a RED source to an analysis proxy: REDline debayers at quarter-res to
/// a scaled ProRes .mov, then ffmpeg re-encodes to the standard H.264 proxy so
/// the rest of the pipeline is format-agnostic.
pub fn create_red_proxy_via_redline(
    redline_path: &str,
    input_path: &str,
    decoded_dir: &Path,
    output_path: &Path,
) -> Result<(), String> {
    validate_proxy_output_path(input_path, output_path)?;
    if decoded_dir.exists() {
        let _ = std::fs::remove_dir_all(decoded_dir);
    }
    std::fs::create_dir_all(decoded_dir)
        .map_err(|e| format!("Failed to prepare RED decode scratch: {e}"))?;
    let base = decoded_dir.join("red_decode");

    // REDline `--format` is an enum: 0=DPX, 1=TIFF, 2=OpenEXR, 3=JPEG, …,
    // 201=Apple ProRes, 204=Avid DNx. `3` (used previously) writes a JPEG image
    // sequence, never a .mov — which is exactly why this step used to report
    // "REDline produced no .mov output". 201 writes `<base>.mov`.
    // `--useMeta` applies the clip's own RMD/embedded look instead of REDline
    // defaults; `--resizeX 1920` keeps the ProRes intermediate small — both are
    // long-stable flags (verified against REDline Build 65).
    let mut cmd = crate::tools::create_command(redline_path);
    cmd.args([
        "--i",
        input_path,
        "--o",
        &base.to_string_lossy(),
        "--format",
        "201",
        "--useMeta",
        "--resizeX",
        "1920",
    ]);
    let out = cmd
        .output()
        .map_err(|e| format!("Failed to start REDline ({redline_path}): {e}"))?;
    if !out.status.success() {
        let code = out.status.code();
        let hint = "\nOpen Decoder Setup to check the RED SDK, or export an MP4/ProRes proxy from REDCINE-X PRO and use 'Select Existing Proxy'.";
        return Err(format!(
            "REDline decode failed.\nInput: {}\nExit code: {}\n{}{}",
            input_path,
            code.map(|v| v.to_string()).unwrap_or_else(|| "signal".to_string()),
            tail_lines(&String::from_utf8_lossy(&out.stderr), 20),
            hint,
        ));
    }

    let decoded_mov = std::fs::read_dir(decoded_dir)
        .map_err(|e| format!("Cannot read RED decode output: {e}"))?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.extension()
                .and_then(|x| x.to_str())
                .map(|x| x.eq_ignore_ascii_case("mov"))
                .unwrap_or(false)
        })
        .ok_or_else(|| {
            format!(
                "REDline produced no .mov output in {}. The RED R3D SDK may be missing — open Decoder Setup.",
                decoded_dir.display()
            )
        })?;

    encode_analysis_proxy(&decoded_mov, output_path)?;
    let _ = std::fs::remove_dir_all(decoded_dir);
    Ok(())
}

/// Decode an ARRIRAW source (`.ari`/`.arx` or ARRIRAW MXF) to an analysis proxy
/// with ARRI's `art-cmd` (`process` mode → Apple ProRes), then re-encode to the
/// shared H.264 proxy. No DaVinci Resolve needed.
///
/// `art-cmd process --input <src> --video-codec prores422 --output <dir>/art_decode.mov`
/// — flag set verified against the published art-cmd v1.0 manual; re-check
/// against the installed ART version if output is missing.
pub fn create_arri_proxy_via_art_cmd(
    art_cmd_path: &str,
    input_path: &str,
    decoded_dir: &Path,
    output_path: &Path,
) -> Result<(), String> {
    validate_proxy_output_path(input_path, output_path)?;
    if decoded_dir.exists() {
        let _ = std::fs::remove_dir_all(decoded_dir);
    }
    std::fs::create_dir_all(decoded_dir)
        .map_err(|e| format!("Failed to prepare ARRI decode scratch: {e}"))?;
    let decoded_mov_path = decoded_dir.join("art_decode.mov");

    let mut cmd = crate::tools::create_command(art_cmd_path);
    cmd.args([
        "process",
        "--input",
        input_path,
        "--video-codec",
        "prores422",
        "--output",
        &decoded_mov_path.to_string_lossy(),
    ]);
    let out = cmd
        .output()
        .map_err(|e| format!("Failed to start ARRI Reference Tool ({art_cmd_path}): {e}"))?;
    if !out.status.success() {
        let code = out.status.code();
        let hint = "\nOpen Decoder Setup to check the ARRI Reference Tool install, or export an MP4/ProRes proxy and use 'Select Existing Proxy'.";
        return Err(format!(
            "ARRI Reference Tool (art-cmd) decode failed.\nInput: {}\nExit code: {}\n{}{}",
            input_path,
            code.map(|v| v.to_string()).unwrap_or_else(|| "signal".to_string()),
            tail_lines(&String::from_utf8_lossy(&out.stderr), 20),
            hint,
        ));
    }

    // art-cmd may write exactly the named file, or a variant name in the same
    // directory (batch/sub-dir behaviour) — accept the first .mov/.mxf it left.
    let decoded = if decoded_mov_path.exists() {
        decoded_mov_path
    } else {
        std::fs::read_dir(decoded_dir)
            .map_err(|e| format!("Cannot read ARRI decode output: {e}"))?
            .flatten()
            .map(|entry| entry.path())
            .find(|path| {
                path.extension()
                    .and_then(|x| x.to_str())
                    .map(|x| x.eq_ignore_ascii_case("mov") || x.eq_ignore_ascii_case("mxf"))
                    .unwrap_or(false)
            })
            .ok_or_else(|| {
                format!(
                    "ARRI Reference Tool produced no ProRes output in {}. Check the ART install in Decoder Setup.",
                    decoded_dir.display()
                )
            })?
    };

    encode_analysis_proxy(&decoded, output_path)?;
    let _ = std::fs::remove_dir_all(decoded_dir);
    Ok(())
}

/// Re-encode any decoded intermediate (ProRes, etc.) to the standard downscaled
/// H.264 analysis proxy, so every decode provider produces an identical proxy
/// shape for the rest of the pipeline.
pub fn encode_analysis_proxy(input: &Path, output: &Path) -> Result<(), String> {
    validate_proxy_output_path(&input.to_string_lossy(), output)?;
    let ff = crate::tools::create_command("ffmpeg")
        .args(["-nostdin", "-hide_banner", "-y", "-i", &input.to_string_lossy()])
        .args(proxy_ffmpeg_args(output))
        .output()
        .map_err(|e| format!("Failed to run ffmpeg for analysis proxy encode: {e}"))?;
    if !ff.status.success() {
        return Err(format!(
            "ffmpeg failed encoding the analysis proxy.\nInput: {}\nOutput: {}\n{}",
            input.display(),
            output.display(),
            tail_lines(&String::from_utf8_lossy(&ff.stderr), 20),
        ));
    }
    Ok(())
}

pub fn classify_source_format(clip_path: &str) -> String {
    let extension = Path::new(clip_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "braw" => "BLACKMAGIC_RAW".to_string(),
        "mov" => "MOV".to_string(),
        "mp4" => "MP4".to_string(),
        other => other.to_uppercase(),
    }
}

pub fn hash_source_signature(clip_path: &str) -> String {
    let mut signature = clip_path.to_string();
    if let Ok(metadata) = std::fs::metadata(clip_path) {
        signature.push_str(&format!("::{}", metadata.len()));
        if let Ok(modified) = metadata.modified() {
            if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                signature.push_str(&format!("::{}", duration.as_secs()));
            }
        }
    }
    hash_string(&signature)
}

pub fn build_frame_timestamps(duration_ms: u64, frame_count: u32) -> Vec<u64> {
    let duration_ms = duration_ms.max(1);
    let max_frames_for_duration = ((duration_ms as f64 / 250.0).floor() as u32).max(1);
    let safe_count = frame_count.clamp(1, 12).min(max_frames_for_duration);
    let duration = duration_ms as f64;
    let start = (duration * 0.05).clamp(0.0, duration - 1.0);
    let end = (duration * 0.95).clamp(start, duration - 1.0);

    if safe_count == 1 || end <= start {
        return vec![((start + end) * 0.5).round().clamp(0.0, duration - 1.0) as u64];
    }

    let step = (end - start) / (safe_count.saturating_sub(1) as f64);
    (0..safe_count)
        .map(|index| {
            (start + step * index as f64)
                .round()
                .clamp(0.0, duration - 1.0) as u64
        })
        .collect()
}

pub fn fallback_timestamps(timestamp_ms: u64) -> Vec<u64> {
    let second = timestamp_ms.saturating_sub(1000).max(200);
    let midpoint = ((timestamp_ms + second) / 2).max(200);
    let mut values = vec![timestamp_ms, second];
    if midpoint != timestamp_ms && midpoint != second {
        values.push(midpoint);
    }
    values
}

pub fn extract_jpeg_frame_with_fallbacks(
    input_path: &str,
    timestamp_ms: u64,
    output_path: &Path,
) -> Result<FrameExtractionSuccess, String> {
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to prepare match lab cache: {}", e))?;
    }
    validate_frame_output_path(output_path)?;

    let tmp_path = build_temp_jpeg_path(output_path);
    if tmp_path.exists() && tmp_path.is_dir() {
        return Err(format!("Match Lab frame temp path is a directory: {}", tmp_path.display()));
    }
    if tmp_path.exists() {
        let _ = std::fs::remove_file(&tmp_path);
    }

    let attempted_timestamps = fallback_timestamps(timestamp_ms);
    let strategies = build_extraction_strategies();
    let mut attempted_labels = Vec::new();
    let mut last_stderr_tail = String::new();

    for timestamp in attempted_timestamps.iter().copied() {
        for strategy in strategies.iter() {
            attempted_labels.push(format!("{} @ {}ms", strategy.label, timestamp));
            let attempt = run_frame_extraction_attempt(input_path, &tmp_path, timestamp, strategy);
            match attempt {
                Ok(()) => {
                    if output_path.exists() {
                        let _ = std::fs::remove_file(output_path);
                    }
                    std::fs::rename(&tmp_path, output_path).map_err(|e| {
                        format!(
                            "Failed to finalize extracted frame.\nInput: {}\nOutput: {}\n{}",
                            input_path,
                            output_path.display(),
                            e
                        )
                    })?;
                    return Ok(FrameExtractionSuccess {
                        used_timestamp_ms: timestamp,
                        strategy_label: strategy.label.to_string(),
                    });
                }
                Err(stderr_tail) => {
                    last_stderr_tail = stderr_tail;
                    let _ = std::fs::remove_file(&tmp_path);
                }
            }
        }
    }

    Err(format!(
        "Could not decode frames from this clip. Try generating a proxy (H.264/H.265) and re-run.\nInput: {}\nAttempted timestamps: {}\nStrategies: {}\nDetails:\n{}",
        input_path,
        attempted_timestamps
            .iter()
            .map(|value| value.to_string())
            .collect::<Vec<_>>()
            .join(", "),
        attempted_labels.join(" | "),
        if last_stderr_tail.is_empty() {
            "ffmpeg did not return stderr output".to_string()
        } else {
            last_stderr_tail
        }
    ))
}

pub fn choose_source_path_for_analysis(clip_path: &str) -> Result<String, String> {
    let extension = Path::new(clip_path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();

    if extension == "braw" {
        return Err("BRAW analysis requires a proxy (MP4). Generate proxy first.".to_string());
    }
    if extension == "nev" {
        return Err("N-RAW (.nev) is not supported. Export an MP4 or ProRes proxy from Nikon NX Studio, then use 'Select Existing Proxy'.".to_string());
    }
    if extension == "r3d" {
        return Err("R3D is not supported. Export an MP4 or ProRes proxy from REDCINE-X PRO, then use 'Select Existing Proxy'.".to_string());
    }

    if is_ffmpeg_reliable_extension(&extension) {
        return Ok(clip_path.to_string());
    }

    Err(format!(
        "Analysis source is not supported directly for .{} files. Provide an MP4 proxy first.",
        extension
    ))
}

pub fn analysis_timeout() -> Duration {
    Duration::from_secs(45)
}

fn is_ffmpeg_reliable_extension(extension: &str) -> bool {
    matches!(extension, "mp4" | "mov" | "mxf" | "mkv" | "avi" | "webm" | "m4v")
}

#[derive(Clone, Copy)]
struct ExtractionStrategy {
    label: &'static str,
    seek_mode: SeekMode,
    hwaccel_none: bool,
    ignore_decode_errors: bool,
    force_pixel_format: bool,
}

#[derive(Clone, Copy)]
enum SeekMode {
    Fast,
    Accurate,
}

pub struct FrameExtractionSuccess {
    pub used_timestamp_ms: u64,
    pub strategy_label: String,
}

fn build_extraction_strategies() -> [ExtractionStrategy; 5] {
    [
        ExtractionStrategy {
            label: "primary",
            seek_mode: SeekMode::Fast,
            hwaccel_none: false,
            ignore_decode_errors: false,
            force_pixel_format: false,
        },
        ExtractionStrategy {
            label: "software-decode",
            seek_mode: SeekMode::Fast,
            hwaccel_none: true,
            ignore_decode_errors: false,
            force_pixel_format: false,
        },
        ExtractionStrategy {
            label: "ignore-corrupt",
            seek_mode: SeekMode::Fast,
            hwaccel_none: false,
            ignore_decode_errors: true,
            force_pixel_format: false,
        },
        ExtractionStrategy {
            label: "safe-seek-order",
            seek_mode: SeekMode::Accurate,
            hwaccel_none: false,
            ignore_decode_errors: false,
            force_pixel_format: false,
        },
        ExtractionStrategy {
            label: "force-yuv420p",
            seek_mode: SeekMode::Fast,
            hwaccel_none: false,
            ignore_decode_errors: false,
            force_pixel_format: true,
        },
    ]
}

fn run_frame_extraction_attempt(
    input_path: &str,
    output_path: &Path,
    timestamp_ms: u64,
    strategy: &ExtractionStrategy,
) -> Result<(), String> {
    let timestamp = format!("{:.3}", timestamp_ms as f64 / 1000.0);
    let mut command = crate::tools::create_command("ffmpeg");
    command.args(["-nostdin", "-hide_banner", "-loglevel", "error", "-y"]);
    if strategy.hwaccel_none {
        command.args(["-hwaccel", "none"]);
    }
    if strategy.ignore_decode_errors {
        command.args(["-err_detect", "ignore_err", "-fflags", "+discardcorrupt"]);
    }
    match strategy.seek_mode {
        SeekMode::Fast => {
            command.args(["-ss", &timestamp, "-i", input_path]);
        }
        SeekMode::Accurate => {
            command.args(["-i", input_path, "-ss", &timestamp]);
        }
    }
    let vf = if strategy.force_pixel_format {
        "scale=1280:-2:flags=lanczos,format=yuv420p"
    } else {
        "scale='min(1280,iw)':-2:flags=bicubic"
    };
    command.args([
        "-an",
        "-sn",
        "-dn",
        "-frames:v",
        "1",
        "-vf",
        vf,
        "-q:v",
        "2",
        &output_path.to_string_lossy(),
    ]);

    let output = command
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(tail_lines(&stderr, 20));
    }
    if !output_path.exists() {
        return Err("ffmpeg reported success but did not create the frame output".to_string());
    }
    let size = std::fs::metadata(output_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if size == 0 {
        return Err("ffmpeg created an empty frame output".to_string());
    }
    Ok(())
}

fn build_temp_jpeg_path(output_path: &Path) -> PathBuf {
    let parent = output_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = output_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "frame".to_string());
    parent.join(format!("{}.tmp.jpg", stem))
}

fn validate_frame_output_path(output_path: &Path) -> Result<(), String> {
    if output_path.exists() && output_path.is_dir() {
        return Err(format!(
            "Match Lab frame output path is a directory: {}",
            output_path.display()
        ));
    }
    Ok(())
}

pub fn analyze_frame(
    frame_index: u32,
    timestamp_ms: u64,
    frame_path: &Path,
    extraction_strategy: Option<String>,
) -> Result<CameraMatchFrameMetrics, String> {
    let image = ::image::open(frame_path)
        .map_err(|e| format!("Failed to read extracted frame {}: {}", frame_path.display(), e))?
        .to_rgb8();
    let (width, height) = image.dimensions();
    let total_pixels = (width as u64).saturating_mul(height as u64).max(1);
    let total_pixels_f64 = total_pixels as f64;

    let mut luma_histogram = vec![0u32; 256];
    let mut red_histogram = vec![0u64; 256];
    let mut green_histogram = vec![0u64; 256];
    let mut blue_histogram = vec![0u64; 256];
    let mut midtone_luma_histogram = vec![0u64; 256];
    let mut midtone_red_histogram = vec![0u64; 256];
    let mut midtone_green_histogram = vec![0u64; 256];
    let mut midtone_blue_histogram = vec![0u64; 256];
    let mut skin_luma_histogram = vec![0u64; 256];
    let mut skin_red_histogram = vec![0u64; 256];
    let mut skin_green_histogram = vec![0u64; 256];
    let mut skin_blue_histogram = vec![0u64; 256];
    let mut highlight_pixels = 0u64;
    let mut midtone_pixels = 0u64;
    let mut shadow_pixels = 0u64;

    // "In the highlights" band — bright but not necessarily clipped. Hard clipping
    // is tracked separately by build_measurement_bundle from the 248/255 bins of
    // this same luma histogram.
    const HIGHLIGHT_LUMA: f64 = 0.90;
    const SHADOW_LUMA: f64 = 0.18;

    for pixel in image.pixels() {
        let red = pixel[0] as usize;
        let green = pixel[1] as usize;
        let blue = pixel[2] as usize;
        let luma = ((0.2126 * red as f64) + (0.7152 * green as f64) + (0.0722 * blue as f64))
            .round()
            .clamp(0.0, 255.0) as usize;
        let luma_normalized = luma as f64 / 255.0;

        luma_histogram[luma] += 1;
        red_histogram[red] += 1;
        green_histogram[green] += 1;
        blue_histogram[blue] += 1;

        if luma_normalized >= HIGHLIGHT_LUMA {
            highlight_pixels += 1;
        }
        if (0.4..=0.7).contains(&luma_normalized) {
            midtone_pixels += 1;
        }
        if (0.2..=0.7).contains(&luma_normalized) {
            midtone_luma_histogram[luma] += 1;
            midtone_red_histogram[red] += 1;
            midtone_green_histogram[green] += 1;
            midtone_blue_histogram[blue] += 1;
        }
        // Skin sampling: a mid-luma window AND a warm-chroma gate, so grey walls,
        // sky and pavement don't pollute the skin-tone medians that drive the
        // skin white-balance delta. Warm ordering (R >= G >= B), a minimum
        // red-over-blue warmth, and a moderate saturation window.
        let max_c = red.max(green).max(blue) as f64;
        let min_c = red.min(green).min(blue) as f64;
        let saturation = if max_c > 0.0 { (max_c - min_c) / max_c } else { 0.0 };
        let is_skin_chroma = red >= green
            && green >= blue
            && (red as i32 - blue as i32) >= 6
            && (0.08..=0.55).contains(&saturation);
        if (0.35..=0.72).contains(&luma_normalized) && is_skin_chroma {
            skin_luma_histogram[luma] += 1;
            skin_red_histogram[red] += 1;
            skin_green_histogram[green] += 1;
            skin_blue_histogram[blue] += 1;
        }
        if luma_normalized < SHADOW_LUMA {
            shadow_pixels += 1;
        }
    }

    let luma_median = histogram_median_u32(&image_hist_to_u64(&luma_histogram));

    Ok(CameraMatchFrameMetrics {
        frame_index,
        timestamp_ms,
        frame_path: frame_path.to_string_lossy().to_string(),
        extraction_strategy,
        width,
        height,
        luma_histogram,
        rgb_medians: CameraMatchRgbMedians {
            red: histogram_median(&red_histogram),
            green: histogram_median(&green_histogram),
            blue: histogram_median(&blue_histogram),
        },
        midtone_rgb_medians: CameraMatchRgbMedians {
            red: histogram_median(&midtone_red_histogram),
            green: histogram_median(&midtone_green_histogram),
            blue: histogram_median(&midtone_blue_histogram),
        },
        skin_rgb_medians: CameraMatchRgbMedians {
            red: histogram_median(&skin_red_histogram),
            green: histogram_median(&skin_green_histogram),
            blue: histogram_median(&skin_blue_histogram),
        },
        luma_median,
        midtone_luma_median: histogram_median(&midtone_luma_histogram),
        skin_luma_median: histogram_median(&skin_luma_histogram),
        highlight_percent: highlight_pixels as f64 / total_pixels_f64,
        midtone_density: midtone_pixels as f64 / total_pixels_f64,
        shadow_percent: shadow_pixels as f64 / total_pixels_f64,
    })
}

pub fn aggregate_frames(per_frame: &[CameraMatchFrameMetrics]) -> CameraMatchAggregateMetrics {
    let frame_count = per_frame.len().max(1) as f64;
    let mut mean_histogram = vec![0.0f64; 256];
    let mut red_values = Vec::with_capacity(per_frame.len());
    let mut green_values = Vec::with_capacity(per_frame.len());
    let mut blue_values = Vec::with_capacity(per_frame.len());
    let mut midtone_red_values = Vec::with_capacity(per_frame.len());
    let mut midtone_green_values = Vec::with_capacity(per_frame.len());
    let mut midtone_blue_values = Vec::with_capacity(per_frame.len());
    let mut skin_red_values = Vec::with_capacity(per_frame.len());
    let mut skin_green_values = Vec::with_capacity(per_frame.len());
    let mut skin_blue_values = Vec::with_capacity(per_frame.len());
    let mut luma_values = Vec::with_capacity(per_frame.len());
    let mut midtone_luma_values = Vec::with_capacity(per_frame.len());
    let mut skin_luma_values = Vec::with_capacity(per_frame.len());
    let mut highlight_values = Vec::with_capacity(per_frame.len());
    let mut midtone_values = Vec::with_capacity(per_frame.len());
    let mut shadow_values = Vec::with_capacity(per_frame.len());

    for frame in per_frame {
        for (index, bin) in frame.luma_histogram.iter().enumerate() {
            mean_histogram[index] += *bin as f64 / frame_count;
        }
        red_values.push(frame.rgb_medians.red);
        green_values.push(frame.rgb_medians.green);
        blue_values.push(frame.rgb_medians.blue);
        midtone_red_values.push(frame.midtone_rgb_medians.red);
        midtone_green_values.push(frame.midtone_rgb_medians.green);
        midtone_blue_values.push(frame.midtone_rgb_medians.blue);
        skin_red_values.push(frame.skin_rgb_medians.red);
        skin_green_values.push(frame.skin_rgb_medians.green);
        skin_blue_values.push(frame.skin_rgb_medians.blue);
        luma_values.push(frame.luma_median);
        midtone_luma_values.push(frame.midtone_luma_median);
        skin_luma_values.push(frame.skin_luma_median);
        highlight_values.push(frame.highlight_percent);
        midtone_values.push(frame.midtone_density);
        shadow_values.push(frame.shadow_percent);
    }

    CameraMatchAggregateMetrics {
        luma_histogram: mean_histogram,
        rgb_medians: CameraMatchRgbMedians {
            red: median_of_values(&mut red_values),
            green: median_of_values(&mut green_values),
            blue: median_of_values(&mut blue_values),
        },
        midtone_rgb_medians: CameraMatchRgbMedians {
            red: median_of_values(&mut midtone_red_values),
            green: median_of_values(&mut midtone_green_values),
            blue: median_of_values(&mut midtone_blue_values),
        },
        skin_rgb_medians: CameraMatchRgbMedians {
            red: median_of_values(&mut skin_red_values),
            green: median_of_values(&mut skin_green_values),
            blue: median_of_values(&mut skin_blue_values),
        },
        luma_median: median_of_values(&mut luma_values),
        midtone_luma_median: median_of_values(&mut midtone_luma_values),
        skin_luma_median: median_of_values(&mut skin_luma_values),
        highlight_percent: mean_of_values(&highlight_values),
        midtone_density: mean_of_values(&midtone_values),
        shadow_percent: mean_of_values(&shadow_values),
        luma_variance: variance_of_values(&luma_values),
        red_variance: variance_of_values(&red_values),
        green_variance: variance_of_values(&green_values),
        blue_variance: variance_of_values(&blue_values),
        highlight_variance: variance_of_values(&highlight_values),
        midtone_variance: variance_of_values(&midtone_values),
        shadow_variance: variance_of_values(&shadow_values),
    }
}

pub fn build_measurement_bundle(
    source_path: &str,
    source_kind: Option<String>,
    original_format_kind: Option<String>,
    metadata: &crate::ffprobe::ClipMetadata,
    aggregate: &CameraMatchAggregateMetrics,
) -> ProductionMeasurementBundle {
    let luma_summary = MeasurementLumaSummary {
        min_luma: first_nonzero_histogram_bin(&aggregate.luma_histogram),
        max_luma: last_nonzero_histogram_bin(&aggregate.luma_histogram),
        median_luma: aggregate.luma_median,
    };
    let false_color_summary = MeasurementFalseColorSummary {
        clipped: histogram_band_density(&aggregate.luma_histogram, 248, 255),
        near_clip: histogram_band_density(&aggregate.luma_histogram, 225, 247),
        skin_zone: histogram_band_density(&aggregate.luma_histogram, 117, 161),
        mids: histogram_band_density(&aggregate.luma_histogram, 72, 116),
        shadows: histogram_band_density(&aggregate.luma_histogram, 11, 45),
        crushed: histogram_band_density(&aggregate.luma_histogram, 0, 10),
    };
    let rgb_balance_summary = MeasurementRgbBalanceSummary {
        red_vs_green: aggregate.rgb_medians.red - aggregate.rgb_medians.green,
        blue_vs_green: aggregate.rgb_medians.blue - aggregate.rgb_medians.green,
        midtone_red_vs_green: Some(aggregate.midtone_rgb_medians.red - aggregate.midtone_rgb_medians.green),
        midtone_blue_vs_green: Some(aggregate.midtone_rgb_medians.blue - aggregate.midtone_rgb_medians.green),
        skin_red_vs_green: Some(aggregate.skin_rgb_medians.red - aggregate.skin_rgb_medians.green),
        skin_blue_vs_green: Some(aggregate.skin_rgb_medians.blue - aggregate.skin_rgb_medians.green),
        green_magenta_hint: green_magenta_hint(
            aggregate.rgb_medians.red,
            aggregate.rgb_medians.green,
            aggregate.rgb_medians.blue,
        ),
    };
    ProductionMeasurementBundle {
        source_path: source_path.to_string(),
        original_format_kind,
        analysis_source_kind: source_kind,
        codec_name: Some(metadata.video_codec.clone()),
        resolution: Some(format!("{}x{}", metadata.width, metadata.height)),
        fps: (metadata.fps > 0.0).then_some(metadata.fps),
        iso_metadata: metadata.camera_iso.clone(),
        wb_metadata: metadata.camera_white_balance.clone(),
        waveform_summary: MeasurementWaveformSummary {
            median_luma: aggregate.luma_median,
            midtone_band_median_luma: Some(aggregate.midtone_luma_median),
            skin_band_median_luma: Some(aggregate.skin_luma_median),
            top_band_density: histogram_band_density(&aggregate.luma_histogram, 204, 255),
            bottom_band_density: histogram_band_density(&aggregate.luma_histogram, 0, 51),
            skin_band_estimate: Some(false_color_summary.skin_zone),
        },
        false_color_summary,
        rgb_balance_summary,
        luma_summary,
        highlight_percentage: aggregate.highlight_percent,
        midtone_percentage: aggregate.midtone_density,
        shadow_percentage: aggregate.shadow_percent,
        calibration_available: None,
        calibration_quality: None,
        calibration_neutral_bias: None,
        calibration_mean_delta_e: None,
    }
}

fn histogram_median(histogram: &[u64]) -> f64 {
    let total: u64 = histogram.iter().sum();
    if total == 0 {
        return 0.0;
    }
    let midpoint = total / 2;
    let mut cumulative = 0u64;
    for (index, count) in histogram.iter().enumerate() {
        cumulative += *count;
        if cumulative >= midpoint {
            return index as f64 / 255.0;
        }
    }
    1.0
}

fn histogram_band_density(histogram: &[f64], start: usize, end: usize) -> f64 {
    let total = histogram.iter().sum::<f64>().max(1.0);
    histogram
        .iter()
        .enumerate()
        .filter(|(index, _)| *index >= start && *index <= end)
        .map(|(_, value)| *value)
        .sum::<f64>()
        / total
}

fn first_nonzero_histogram_bin(histogram: &[f64]) -> f64 {
    histogram
        .iter()
        .position(|value| *value > 0.0)
        .map(|index| index as f64 / 255.0)
        .unwrap_or(0.0)
}

fn last_nonzero_histogram_bin(histogram: &[f64]) -> f64 {
    histogram
        .iter()
        .rposition(|value| *value > 0.0)
        .map(|index| index as f64 / 255.0)
        .unwrap_or(0.0)
}

fn green_magenta_hint(red: f64, green: f64, blue: f64) -> Option<String> {
    let green_delta = green - ((red + blue) * 0.5);
    if green_delta > 0.03 {
        Some("Green".to_string())
    } else if green_delta < -0.03 {
        Some("Magenta".to_string())
    } else {
        Some("Neutral".to_string())
    }
}

fn histogram_median_u32(histogram: &[u64]) -> f64 {
    histogram_median(histogram)
}

fn image_hist_to_u64(histogram: &[u32]) -> Vec<u64> {
    histogram.iter().map(|value| *value as u64).collect()
}

fn median_of_values(values: &mut [f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mid = values.len() / 2;
    if values.len() % 2 == 0 {
      (values[mid - 1] + values[mid]) * 0.5
    } else {
      values[mid]
    }
}

fn mean_of_values(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f64>() / values.len() as f64
}

fn variance_of_values(values: &[f64]) -> f64 {
    if values.len() < 2 {
        return 0.0;
    }
    let mean = mean_of_values(values);
    values
        .iter()
        .map(|value| {
            let delta = *value - mean;
            delta * delta
        })
        .sum::<f64>()
        / values.len() as f64
}

fn hash_string(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

pub fn validate_proxy_output_path(input_path: &str, output_path: &Path) -> Result<(), String> {
    if input_path.contains("file://") {
        return Err(format!("Proxy input path must be a filesystem path, got URI-style path: {}", input_path));
    }
    let output_string = output_path.to_string_lossy();
    if output_string.contains("file://") {
        return Err(format!("Proxy output path must be a filesystem path, got URI-style path: {}", output_string));
    }
    if output_path.exists() && output_path.is_dir() {
        return Err(format!("Proxy output path is a directory: {}", output_path.display()));
    }
    Ok(())
}

pub fn build_proxy_validation_report(
    source_path: &str,
    proxy_path: &str,
    source_metadata: Option<&crate::ffprobe::ClipMetadata>,
    proxy_metadata: &crate::ffprobe::ClipMetadata,
    source_profile_id: Option<&str>,
    analysis_color_space: Option<&str>,
    operator_selected: bool,
) -> ProductionProxyValidationReport {
    let mut warnings = Vec::new();
    let source_duration_ms = source_metadata.map(|metadata| metadata.duration_ms);
    let proxy_duration_ms = (proxy_metadata.duration_ms > 0).then_some(proxy_metadata.duration_ms);
    let source_frame_count_estimate = source_metadata.and_then(estimate_proxy_frame_count);
    let proxy_frame_count_estimate = estimate_proxy_frame_count(proxy_metadata);
    let source_resolution = source_metadata.and_then(format_proxy_resolution);
    let proxy_resolution = format_proxy_resolution(proxy_metadata);

    if let (Some(source_duration), Some(proxy_duration)) = (source_duration_ms, proxy_duration_ms) {
        let delta = source_duration.abs_diff(proxy_duration);
        let tolerance = ((source_duration as f64) * 0.05).max(1_000.0) as u64;
        if delta > tolerance {
            warnings.push(format!(
                "Proxy duration differs from source by {}ms. Verify the proxy was exported from the same clip.",
                delta
            ));
        }
    } else {
        warnings.push(
            "Source or proxy duration is unavailable, so frame-count pairing is weak.".to_string(),
        );
    }

    if let (Some(source_frames), Some(proxy_frames)) =
        (source_frame_count_estimate, proxy_frame_count_estimate)
    {
        let delta = source_frames.abs_diff(proxy_frames);
        let tolerance = ((source_frames as f64) * 0.05).max(2.0) as u64;
        if delta > tolerance {
            warnings.push(format!(
                "Proxy frame-count estimate differs from source by {} frames.",
                delta
            ));
        }
    }

    if proxy_metadata.width == 0 || proxy_metadata.height == 0 {
        warnings.push("Proxy resolution is unavailable.".to_string());
    } else if proxy_metadata.width < 1280 || proxy_metadata.height < 720 {
        warnings.push(format!(
            "Proxy resolution is low ({}x{}). Export at least 720p for analysis.",
            proxy_metadata.width, proxy_metadata.height
        ));
    }

    if !is_analysis_proxy_codec(&proxy_metadata.video_codec) {
        warnings.push(format!(
            "Proxy codec '{}' is readable but not a preferred analysis codec. Use H.264, H.265/HEVC, ProRes, or DNxHR when possible.",
            proxy_metadata.video_codec
        ));
    }

    let source_pairing = if operator_selected {
        let paired = proxy_stem_pairs_with_source(source_path, proxy_path);
        if !paired {
            warnings.push(
                "Proxy filename does not appear to match the RAW source name. Confirm source pairing before trusting match results."
                    .to_string(),
            );
        }
        if paired {
            "operator_filename_match"
        } else {
            "operator_unverified"
        }
    } else {
        "generated_from_source"
    }
    .to_string();

    let color_pipeline_note = format!(
        "Proxy should preserve source profile {} into {} analysis.",
        source_profile_id.unwrap_or("unconfirmed"),
        analysis_color_space.unwrap_or("ACEScct")
    );

    let validation_status = if warnings.is_empty() {
        "validated"
    } else {
        "warnings"
    }
    .to_string();

    ProductionProxyValidationReport {
        source_path: source_path.to_string(),
        proxy_path: proxy_path.to_string(),
        validation_status,
        source_duration_ms,
        proxy_duration_ms,
        source_frame_count_estimate,
        proxy_frame_count_estimate,
        source_resolution,
        proxy_resolution,
        proxy_codec: Some(proxy_metadata.video_codec.clone()),
        source_pairing,
        color_pipeline_note,
        warnings,
    }
}

fn estimate_proxy_frame_count(metadata: &crate::ffprobe::ClipMetadata) -> Option<u64> {
    if metadata.duration_ms == 0 || metadata.fps <= 0.0 {
        return None;
    }
    Some(((metadata.duration_ms as f64 / 1000.0) * metadata.fps).round() as u64)
}

fn format_proxy_resolution(metadata: &crate::ffprobe::ClipMetadata) -> Option<String> {
    if metadata.width == 0 || metadata.height == 0 {
        return None;
    }
    Some(format!("{}x{}", metadata.width, metadata.height))
}

fn is_analysis_proxy_codec(codec: &str) -> bool {
    matches!(
        codec.to_ascii_lowercase().as_str(),
        "h264" | "h.264" | "avc1" | "hevc" | "h265" | "h.265" | "prores" | "dnxhd" | "dnxhr"
    )
}

fn proxy_stem_pairs_with_source(source_path: &str, proxy_path: &str) -> bool {
    let source = normalized_file_stem(source_path);
    let proxy = normalized_file_stem(proxy_path);
    !source.is_empty() && !proxy.is_empty() && (source.contains(&proxy) || proxy.contains(&source))
}

fn normalized_file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .chars()
        .filter(|value| value.is_ascii_alphanumeric())
        .flat_map(|value| value.to_lowercase())
        .collect()
}

pub fn probe_braw_decoder(resource_dir: Option<&Path>) -> BrawDecoderCaps {
    let Some((executable_path, working_dir)) = locate_braw_decoder(resource_dir) else {
        return BrawDecoderCaps {
            found: false,
            executable_path: None,
            working_dir: None,
            supports_stdout: false,
            supports_output_flag: false,
            help_excerpt: "braw-decode not found".to_string(),
            version: None,
        };
    };

    let mut help_cmd = crate::tools::create_command(&executable_path);
    help_cmd.arg("--help");
    if let Some(ref dir) = working_dir {
        help_cmd.current_dir(dir);
    }
    let help_output = help_cmd
        .output()
        .or_else(|_| {
            let mut cmd = crate::tools::create_command(&executable_path);
            cmd.arg("-h");
            if let Some(ref dir) = working_dir {
                cmd.current_dir(dir);
            }
            cmd.output()
        });

    let (help_text, help_excerpt) = match help_output {
        Ok(output) => {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            let excerpt = combined
                .lines()
                .filter(|line| !line.trim().is_empty())
                .take(2)
                .collect::<Vec<_>>()
                .join(" | ");
            (combined.to_lowercase(), excerpt)
        }
        Err(error) => (
            String::new(),
            format!("help unavailable: {}", error),
        ),
    };

    let supports_output_flag = help_text.contains("--output")
        || help_text.contains("-o ")
        || help_text.contains(" output file");
    let supports_stdout = help_text.contains("stdout")
        || help_text.contains("pipe")
        || help_text.contains("ffmpeg")
        || help_text.contains(" -f ");

    BrawDecoderCaps {
        found: true,
        executable_path: Some(executable_path),
        working_dir,
        supports_stdout,
        supports_output_flag,
        help_excerpt,
        version: None,
    }
}

/// Build the ffmpeg `-f rawvideo …` input arguments for a braw_bridge stdout pipe.
///
/// The dimensions MUST come from braw_bridge itself: ffprobe reports the BRAW
/// container / sensor size (e.g. 6176x3472), but braw_bridge decodes to the
/// SDK's active image area (e.g. 6144x3456). Feeding ffmpeg the ffprobe size
/// mis-frames every raw frame on the pipe — ffmpeg then emits "No filtered
/// frames", writes an empty file, and the resulting SIGPIPE makes braw_bridge
/// look like it crashed. We ask braw_bridge (`--info`) first and only fall back
/// to ffprobe if that fails.
pub fn build_braw_ffmpeg_input_args(caps: &BrawDecoderCaps, input_path: &str) -> Result<String, String> {
    if let Some(exe) = caps.executable_path.as_deref() {
        if let Some(args) = braw_bridge_input_args(exe, caps.working_dir.as_deref(), input_path) {
            return Ok(args);
        }
    }
    build_braw_ffmpeg_input_args_via_ffprobe(input_path)
}

/// Parse `braw_bridge --info` ("Resolution: WxH", "Framerate: N") into ffmpeg
/// raw-pipe input args. Returns None if the probe can't be run or parsed.
fn braw_bridge_input_args(executable: &str, working_dir: Option<&str>, input_path: &str) -> Option<String> {
    let mut cmd = crate::tools::create_command(executable);
    cmd.args(["--info", input_path]);
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }
    let out = cmd.output().ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    let mut width = 0u32;
    let mut height = 0u32;
    let mut fps = String::from("24");
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("Resolution:") {
            let mut parts = rest.trim().split(['x', 'X']);
            width = parts.next().and_then(|v| v.trim().parse().ok()).unwrap_or(0);
            height = parts.next().and_then(|v| v.trim().parse().ok()).unwrap_or(0);
        } else if let Some(rest) = line.strip_prefix("Framerate:") {
            let raw = rest.trim();
            if !raw.is_empty() {
                fps = raw.to_string();
            }
        }
    }
    if width == 0 || height == 0 {
        return None;
    }
    Some(format!(
        "-f rawvideo -pixel_format rgba -s {}x{} -r {} -i pipe:0",
        width, height, fps
    ))
}

fn build_braw_ffmpeg_input_args_via_ffprobe(input_path: &str) -> Result<String, String> {
    #[derive(serde::Deserialize)]
    struct ProbeOut { streams: Option<Vec<ProbeStream>> }
    #[derive(serde::Deserialize)]
    struct ProbeStream {
        codec_type: Option<String>,
        width: Option<u32>,
        height: Option<u32>,
        r_frame_rate: Option<String>,
        avg_frame_rate: Option<String>,
    }

    let output = crate::tools::create_command("ffprobe")
        .args(["-v", "quiet", "-print_format", "json", "-show_streams", input_path])
        .output()
        .map_err(|e| format!("ffprobe failed on BRAW file: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe could not read BRAW file — install Blackmagic RAW SDK or use an MP4 proxy.\nDetails: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let probe: ProbeOut = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output for BRAW file: {}", e))?;

    let video = probe
        .streams
        .unwrap_or_default()
        .into_iter()
        .find(|s| s.codec_type.as_deref() == Some("video"));

    let width = video.as_ref().and_then(|s| s.width).unwrap_or(0);
    let height = video.as_ref().and_then(|s| s.height).unwrap_or(0);

    if width == 0 || height == 0 {
        return Err(format!(
            "Could not determine video dimensions from BRAW file — use an MP4 proxy.\nFile: {}",
            input_path
        ));
    }

    let fps_raw = video
        .as_ref()
        .and_then(|s| s.avg_frame_rate.as_ref().or(s.r_frame_rate.as_ref()))
        .cloned()
        .unwrap_or_else(|| "24/1".to_string());

    // Simplify clean fractions: "25/1" → "25", "24000/1001" stays as-is
    let fps = if fps_raw.ends_with("/1") {
        fps_raw.trim_end_matches("/1").to_string()
    } else {
        fps_raw
    };

    Ok(format!(
        "-f rawvideo -pixel_format rgba -s {}x{} -r {} -i pipe:0",
        width, height, fps
    ))
}

pub fn create_braw_proxy_via_stdout(
    caps: &BrawDecoderCaps,
    input_path: &str,
    output_path: &Path,
) -> Result<(), String> {
    let executable = caps
        .executable_path
        .as_ref()
        .ok_or("Decoder executable missing".to_string())?;
    let fmt_args = build_braw_ffmpeg_input_args(caps, input_path)?;
    validate_proxy_output_path(input_path, output_path)?;

    let mut braw_decode_cmd = crate::tools::create_command(executable);
    braw_decode_cmd
        .args(["-c", "rgba", input_path])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(ref dir) = caps.working_dir {
        braw_decode_cmd.current_dir(dir);
    }

    let mut braw_child = braw_decode_cmd
        .spawn()
        .map_err(|e| format!("Failed to start BRAW decoder: {}", e))?;
    let stdout = braw_child
        .stdout
        .take()
        .ok_or("Failed to capture BRAW decoder stdout".to_string())?;

    let mut ffmpeg_args: Vec<String> = vec!["-nostdin".to_string(), "-hide_banner".to_string(), "-y".to_string()];
    ffmpeg_args.extend(fmt_args.split_whitespace().map(|value| value.to_string()));
    ffmpeg_args.extend(proxy_ffmpeg_args(output_path));

    let mut ffmpeg_child = crate::tools::create_command("ffmpeg")
        .args(ffmpeg_args)
        .stdin(Stdio::from(stdout))
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start ffmpeg: {}", e))?;

    let ffmpeg_status = ffmpeg_child
        .wait()
        .map_err(|e| format!("Failed waiting for ffmpeg: {}", e))?;
    let braw_status = braw_child
        .wait()
        .map_err(|e| format!("Failed waiting for BRAW decoder: {}", e))?;

    let ffmpeg_stderr = read_child_stderr(&mut ffmpeg_child);
    let braw_stderr = read_child_stderr(&mut braw_child);

    if !ffmpeg_status.success() || !braw_status.success() {
        let braw_code = braw_status.code();
        let ffmpeg_code = ffmpeg_status.code();
        let exit_code = ffmpeg_code
            .or(braw_code)
            .map(|value| value.to_string())
            .unwrap_or_else(|| "signal".to_string());

        let excerpt = if !ffmpeg_stderr.trim().is_empty() {
            tail_lines(&ffmpeg_stderr, 20)
        } else {
            tail_lines(&braw_stderr, 20)
        };

        // Detect braw_bridge crash (SIGSEGV = 139, or no exit code = killed by signal)
        // This usually means the Blackmagic RAW SDK is not installed on this machine.
        let sdk_hint = if braw_code.is_none() || braw_code == Some(139) || braw_code.map(|c| c > 127).unwrap_or(false) {
            "\nBRAW decoder crashed — Blackmagic RAW SDK may not be installed.\nNext steps: Install Blackmagic RAW SDK or use an MP4/ProRes proxy file instead."
        } else {
            "\nNext steps: Use an MP4/ProRes proxy file instead."
        };

        return Err(format!(
            "Input: {}\nOutput: {}\nExit code: {}\n{}{}",
            input_path,
            output_path.display(),
            exit_code,
            excerpt,
            sdk_hint
        ));
    }

    // Both processes exited 0 but braw_bridge may have silently produced no frames
    // when the Blackmagic RAW SDK is not installed on this machine.
    let output_size = std::fs::metadata(output_path).map(|m| m.len()).unwrap_or(0);
    if output_size == 0 {
        let _ = std::fs::remove_file(output_path);
        return Err(format!(
            "Input: {}\nOutput: {}\nBRAW decoder produced no frames — Blackmagic RAW SDK may not be installed.\nNext steps: Install Blackmagic RAW SDK or use an MP4/ProRes proxy file instead.",
            input_path,
            output_path.display()
        ));
    }

    Ok(())
}

pub fn create_braw_proxy_via_file(
    caps: &BrawDecoderCaps,
    input_path: &str,
    decoded_path: &Path,
    output_path: &Path,
) -> Result<(), String> {
    let executable = caps
        .executable_path
        .as_ref()
        .ok_or("Decoder executable missing".to_string())?;
    validate_proxy_output_path(input_path, decoded_path)?;
    validate_proxy_output_path(input_path, output_path)?;

    let output_flag = if caps.help_excerpt.to_lowercase().contains("--output") {
        "--output"
    } else {
        "-o"
    };
    let mut file_decode_cmd = crate::tools::create_command(executable);
    file_decode_cmd.args([input_path, output_flag, &decoded_path.to_string_lossy()]);
    if let Some(ref dir) = caps.working_dir {
        file_decode_cmd.current_dir(dir);
    }
    let decode_output = file_decode_cmd
        .output()
        .map_err(|e| format!("Failed to start BRAW decoder file output: {}", e))?;
    if !decode_output.status.success() {
        let code = decode_output.status.code();
        let sdk_hint = if code.is_none() || code == Some(139) || code.map(|c| c > 127).unwrap_or(false) {
            "\nBRAW decoder crashed — Blackmagic RAW SDK may not be installed.\nNext steps: Install Blackmagic RAW SDK or use an MP4/ProRes proxy file instead."
        } else {
            "\nNext steps: Use an MP4/ProRes proxy file instead."
        };
        return Err(format!(
            "Input: {}\nOutput: {}\nExit code: {}\n{}{}",
            input_path,
            decoded_path.display(),
            code.map(|value| value.to_string()).unwrap_or_else(|| "signal".to_string()),
            tail_lines(&String::from_utf8_lossy(&decode_output.stderr), 20),
            sdk_hint
        ));
    }

    let ffmpeg_output = crate::tools::create_command("ffmpeg")
        .args(["-nostdin"])
        .args([
            "-hide_banner",
            "-y",
            "-i",
            &decoded_path.to_string_lossy(),
        ])
        .args(proxy_ffmpeg_args(output_path))
        .output()
        .map_err(|e| format!("Failed to run ffmpeg for proxy encode: {}", e))?;
    if !ffmpeg_output.status.success() {
        return Err(format!(
            "Input: {}\nOutput: {}\nExit code: {}\n{}",
            decoded_path.display(),
            output_path.display(),
            ffmpeg_output
                .status
                .code()
                .map(|value| value.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            tail_lines(&String::from_utf8_lossy(&ffmpeg_output.stderr), 20)
        ));
    }
    let _ = std::fs::remove_file(decoded_path);
    Ok(())
}

fn read_child_stderr(child: &mut std::process::Child) -> String {
    let mut stderr_output = String::new();
    if let Some(stderr) = child.stderr.as_mut() {
        let _ = stderr.read_to_string(&mut stderr_output);
    }
    stderr_output
}

fn tail_lines(value: &str, limit: usize) -> String {
    let lines: Vec<&str> = value.lines().collect();
    let start = lines.len().saturating_sub(limit);
    lines[start..].join("\n")
}

/// Returns `(executable_path, working_dir)`.
/// The binary loads `./Libraries/BlackmagicRawAPI.framework/` relative to its cwd,
/// so we must set current_dir to a directory that has that folder adjacent.
fn locate_braw_decoder(resource_dir: Option<&Path>) -> Option<(String, Option<String>)> {
    let sdk_subpath = Path::new("Libraries").join("BlackmagicRawAPI.framework");

    let sdk_present_at = |dir: &Path| {
        // macOS: bundled framework in ./Libraries/. Windows: BlackmagicRawAPI.dll
        // next to the bridge exe. Linux: the .so next to it.
        dir.join(&sdk_subpath).exists()
            || dir.join("BlackmagicRawAPI.dll").exists()
            || dir.join("libBlackmagicRawAPI.so").exists()
    };

    // 1. Bundled sidecar — preferred in production when SDK is adjacent (dev) or in resources
    let path = crate::tools::find_executable("braw_bridge");
    if path != "braw_bridge" && Path::new(&path).exists() {
        // Check SDK next to binary (dev: src-tauri/bin/Libraries/, or prod: Contents/MacOS/Libraries/)
        let bin_parent = Path::new(&path).parent().map(|p| p.to_path_buf());
        if let Some(ref parent) = bin_parent {
            if sdk_present_at(parent) {
                return Some((path, Some(parent.to_string_lossy().to_string())));
            }
        }
        // Check SDK in Tauri resource dir (prod: Contents/Resources/Libraries/)
        if let Some(res_dir) = resource_dir {
            if sdk_present_at(res_dir) {
                return Some((path, Some(res_dir.to_string_lossy().to_string())));
            }
        }
        // SDK not adjacent — fall through to Homebrew before giving up on bundled binary.
        // Homebrew wrapper script (bundles its own SDK, handles cwd via exec wrapper)
        #[cfg(target_os = "macos")]
        for wrapper in ["/opt/homebrew/bin/braw-decode", "/usr/local/bin/braw-decode"] {
            if Path::new(wrapper).exists() {
                return Some((wrapper.to_string(), None));
            }
        }

        // Homebrew binary directly (needs its own dir as cwd)
        #[cfg(target_os = "macos")]
        {
            let opt_bin = "/opt/homebrew/opt/braw-decode/braw-decode-bin";
            let opt_dir = Path::new("/opt/homebrew/opt/braw-decode");
            if Path::new(opt_bin).exists() && sdk_present_at(opt_dir) {
                return Some((opt_bin.to_string(), Some(opt_dir.to_string_lossy().to_string())));
            }
        }

        // Bundled binary found but no SDK anywhere — not usable
        return None;
    }

    // 5. Try braw-decode sidecar name
    let path = crate::tools::find_executable("braw-decode");
    if path != "braw-decode" && Path::new(&path).exists() {
        let working_dir = Path::new(&path)
            .parent()
            .filter(|p| sdk_present_at(p))
            .map(|p| p.to_string_lossy().to_string());
        return Some((path, working_dir));
    }

    // 6. Homebrew fallback when no bundled sidecar
    #[cfg(target_os = "macos")]
    {
        for wrapper in ["/opt/homebrew/bin/braw-decode", "/usr/local/bin/braw-decode"] {
            if Path::new(wrapper).exists() {
                return Some((wrapper.to_string(), None));
            }
        }
        let opt_bin = "/opt/homebrew/opt/braw-decode/braw-decode-bin";
        let opt_dir = Path::new("/opt/homebrew/opt/braw-decode");
        if Path::new(opt_bin).exists() && sdk_present_at(opt_dir) {
            return Some((opt_bin.to_string(), Some(opt_dir.to_string_lossy().to_string())));
        }
    }

    None
}

fn proxy_ffmpeg_args(output_path: &Path) -> Vec<String> {
    vec![
        "-vf".to_string(),
        "scale=min(1920\\,iw):-2".to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "-crf".to_string(),
        "18".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "160k".to_string(),
        output_path.to_string_lossy().to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::{
        compute_production_match_confidence, CameraMatchAggregateMetrics, CameraMatchAnalysisResult,
        ProductionMatchConfidenceInput, ProductionMeasurementBundle,
    };

    fn baseline_input() -> ProductionMatchConfidenceInput<'static> {
        ProductionMatchConfidenceInput {
            decode_path_kind: Some("direct_original"),
            source_profile_id: Some("SONY_SLOG3_SGAMUT3_CINE"),
            color_transform_status: Some("transform_applied"),
            metrics_trusted: Some(true),
            proxy_validation_status: None,
            proxy_warning_count: 0,
            chart_detected: Some(true),
            calibration_quality_score: Some(0.92),
            clipped_patch_count: 0,
            frame_count: 5,
        }
    }

    fn sample_analysis_result() -> CameraMatchAnalysisResult {
        CameraMatchAnalysisResult {
            source_path: "/clip/A001.mov".to_string(),
            source_kind: Some("original".to_string()),
            original_format_kind: Some("QUICKTIME".to_string()),
            decode_path_kind: None,
            decode_source_path: None,
            clip_path: "/clip/A001.mov".to_string(),
            clip_name: "A001.mov".to_string(),
            representative_frame_path: "/cache/frame_0.jpg".to_string(),
            frame_paths: vec!["/cache/frame_0.jpg".to_string()],
            per_frame: Vec::new(),
            aggregate: CameraMatchAggregateMetrics::default(),
            proxy_info: None,
            proxy_validation: None,
            warnings: Vec::new(),
            measurement_bundle: ProductionMeasurementBundle::default(),
            source_profile_id: None,
            analysis_color_space: None,
            color_transform_status: None,
            color_transform_engine: None,
            ocio_config_status: None,
            ocio_config_source: None,
            ocio_config_path: None,
            transform_path_kind: None,
            ocio_processor_path: None,
            trust_fallback_reason: None,
            metrics_trusted: None,
        }
    }

    fn sample_clip_metadata(path: &str, duration_ms: u64, fps: f64) -> crate::ffprobe::ClipMetadata {
        crate::ffprobe::ClipMetadata {
            filename: super::clip_name_from_path(path),
            file_path: path.to_string(),
            size_bytes: 2_000_000,
            created_at: String::new(),
            duration_ms,
            fps,
            avg_frame_rate: Some("24/1".to_string()),
            r_frame_rate: Some("24/1".to_string()),
            is_vfr: false,
            width: 1920,
            height: 1080,
            video_codec: "h264".to_string(),
            video_bitrate: 8_000_000,
            format_name: "mov".to_string(),
            pixel_format: Some("yuv420p".to_string()),
            bit_depth: Some(8),
            color_range: None,
            codec_tag: None,
            audio_codec: "none".to_string(),
            audio_channels: 0,
            audio_sample_rate: 0,
            camera_iso: None,
            camera_lens: None,
            camera_white_balance: None,
            camera_aperture: None,
            camera_angle: None,
            audio_summary: "No audio".to_string(),
            timecode: None,
            color_space: None,
            color_transfer: None,
            color_primaries: None,
        }
    }

    #[test]
    fn proxy_validation_accepts_matching_h264_proxy() {
        let source = sample_clip_metadata("/camera/A001.braw", 10_000, 24.0);
        let proxy = sample_clip_metadata("/proxy/A001_proxy.mp4", 10_020, 24.0);

        let report = super::build_proxy_validation_report(
            "/camera/A001.braw",
            "/proxy/A001_proxy.mp4",
            Some(&source),
            &proxy,
            Some("BMD_FILM_GEN5_WIDE_GAMUT"),
            Some("ACEScct"),
            true,
        );

        assert_eq!(report.validation_status, "validated");
        assert_eq!(report.source_pairing, "operator_filename_match");
        assert_eq!(report.proxy_codec.as_deref(), Some("h264"));
        assert_eq!(report.source_frame_count_estimate, Some(240));
        assert_eq!(report.proxy_frame_count_estimate, Some(240));
    }

    #[test]
    fn proxy_validation_warns_for_mismatched_operator_proxy() {
        let source = sample_clip_metadata("/camera/A001.braw", 10_000, 24.0);
        let proxy = sample_clip_metadata("/proxy/B999.mp4", 18_000, 24.0);

        let report = super::build_proxy_validation_report(
            "/camera/A001.braw",
            "/proxy/B999.mp4",
            Some(&source),
            &proxy,
            Some("BMD_FILM_GEN5_WIDE_GAMUT"),
            Some("ACEScct"),
            true,
        );

        assert_eq!(report.validation_status, "warnings");
        assert_eq!(report.source_pairing, "operator_unverified");
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("duration differs")));
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("does not appear to match")));
    }

    #[test]
    fn proxy_validation_warns_for_non_preferred_codec() {
        let mut proxy = sample_clip_metadata("/proxy/A001.mp4", 10_000, 24.0);
        proxy.video_codec = "mpeg4".to_string();

        let report = super::build_proxy_validation_report(
            "/camera/A001.r3d",
            "/proxy/A001.mp4",
            None,
            &proxy,
            Some("RED_LOG3G10_RED_WIDE_GAMUT"),
            Some("ACEScct"),
            true,
        );

        assert_eq!(report.validation_status, "warnings");
        assert!(report
            .warnings
            .iter()
            .any(|warning| warning.contains("not a preferred analysis codec")));
    }

    #[test]
    fn analysis_result_carries_transform_intent() {
        let mut result = sample_analysis_result();
        result.source_profile_id = Some("SONY_SLOG3_SGAMUT3_CINE".to_string());
        result.analysis_color_space = Some("ACEScct".to_string());
        result.color_transform_status = Some("metadata_only".to_string());
        result.color_transform_engine = Some("OpenColorIO/ACES".to_string());
        result.ocio_config_status = Some("metadata_only".to_string());
        result.ocio_config_source = Some("metadata".to_string());
        result.ocio_config_path = None;
        result.metrics_trusted = Some(false);

        let json = serde_json::to_string(&result).expect("serialize analysis result");
        let decoded: CameraMatchAnalysisResult =
            serde_json::from_str(&json).expect("deserialize analysis result");

        assert_eq!(
            decoded.source_profile_id.as_deref(),
            Some("SONY_SLOG3_SGAMUT3_CINE")
        );
        assert_eq!(decoded.analysis_color_space.as_deref(), Some("ACEScct"));
        assert_eq!(
            decoded.color_transform_status.as_deref(),
            Some("metadata_only")
        );
        assert_eq!(
            decoded.color_transform_engine.as_deref(),
            Some("OpenColorIO/ACES")
        );
        assert_eq!(decoded.ocio_config_status.as_deref(), Some("metadata_only"));
        assert_eq!(decoded.ocio_config_source.as_deref(), Some("metadata"));
        assert_eq!(decoded.ocio_config_path.as_deref(), None);
        assert_eq!(decoded.metrics_trusted, Some(false));
    }

    #[test]
    fn analysis_result_carries_decode_and_transform_provenance() {
        let mut result = sample_analysis_result();
        result.decode_path_kind = Some("direct_original".to_string());
        result.decode_source_path = Some("/clip/A001.mov".to_string());
        result.transform_path_kind = Some("ocio_frame_transform".to_string());
        result.ocio_processor_path = Some("/usr/local/bin/ocioconvert".to_string());
        result.trust_fallback_reason = None;
        result.metrics_trusted = Some(true);

        let json = serde_json::to_string(&result).expect("serialize analysis result");
        let decoded: CameraMatchAnalysisResult =
            serde_json::from_str(&json).expect("deserialize analysis result");

        assert_eq!(decoded.decode_path_kind.as_deref(), Some("direct_original"));
        assert_eq!(decoded.decode_source_path.as_deref(), Some("/clip/A001.mov"));
        assert_eq!(
            decoded.transform_path_kind.as_deref(),
            Some("ocio_frame_transform")
        );
        assert_eq!(
            decoded.ocio_processor_path.as_deref(),
            Some("/usr/local/bin/ocioconvert")
        );
        assert_eq!(decoded.trust_fallback_reason, None);
        assert_eq!(decoded.metrics_trusted, Some(true));
    }

    #[test]
    fn confidence_is_high_for_complete_direct_analysis() {
        assert_eq!(compute_production_match_confidence(&baseline_input()), 96);
    }

    #[test]
    fn confidence_decreases_for_decode_and_profile_risks() {
        let mut operator_proxy = baseline_input();
        operator_proxy.decode_path_kind = Some("operator_proxy");
        assert!(compute_production_match_confidence(&operator_proxy) < 80);

        let mut unsupported = baseline_input();
        unsupported.decode_path_kind = Some("unsupported_original");
        assert!(compute_production_match_confidence(&unsupported) < 50);

        let mut missing_profile = baseline_input();
        missing_profile.source_profile_id = None;
        assert!(compute_production_match_confidence(&missing_profile) < 85);
    }

    #[test]
    fn confidence_not_attempted_chart_beats_failed_chart() {
        let mut not_attempted = baseline_input();
        not_attempted.chart_detected = None;
        not_attempted.calibration_quality_score = None;

        let mut failed = baseline_input();
        failed.chart_detected = Some(false);

        assert!(
            compute_production_match_confidence(&not_attempted)
                > compute_production_match_confidence(&failed)
        );
    }

    #[test]
    fn confidence_has_evidence_floor_for_chartless_but_solid_analysis() {
        // Chartless, but original decode + applied transform + trusted metrics +
        // a healthy frame sample: still trustworthy.
        let mut solid = baseline_input();
        solid.chart_detected = None;
        solid.calibration_quality_score = None;
        solid.frame_count = 12;
        assert!(compute_production_match_confidence(&solid) >= 78);

        // The floor must not paper over a genuinely weak analysis.
        let mut weak = baseline_input();
        weak.chart_detected = None;
        weak.calibration_quality_score = None;
        weak.frame_count = 12;
        weak.decode_path_kind = Some("operator_proxy");
        assert!(compute_production_match_confidence(&weak) < 78);
    }

    #[test]
    fn confidence_decreases_for_chart_and_sampling_risks() {
        let mut failed_chart = baseline_input();
        failed_chart.chart_detected = Some(false);
        assert!(compute_production_match_confidence(&failed_chart) < 70);

        let mut clipped_patches = baseline_input();
        clipped_patches.clipped_patch_count = 4;
        assert!(compute_production_match_confidence(&clipped_patches) < 85);

        let mut low_frame_count = baseline_input();
        low_frame_count.frame_count = 1;
        assert!(compute_production_match_confidence(&low_frame_count) < 85);
    }

    #[test]
    fn confidence_decreases_for_transform_and_proxy_risks() {
        let mut metadata_only = baseline_input();
        metadata_only.color_transform_status = Some("metadata_only");
        metadata_only.metrics_trusted = Some(false);
        assert!(compute_production_match_confidence(&metadata_only) < 75);

        let mut weak_proxy = baseline_input();
        weak_proxy.decode_path_kind = Some("operator_proxy");
        weak_proxy.proxy_validation_status = Some("warnings");
        weak_proxy.proxy_warning_count = 2;
        assert!(compute_production_match_confidence(&weak_proxy) < 65);

        let mut missing_trust = baseline_input();
        missing_trust.metrics_trusted = None;
        assert!(compute_production_match_confidence(&missing_trust) < 90);
    }

    #[test]
    fn raw_provider_routing_by_extension() {
        assert!(super::is_braw_path("/x/A001.braw"));
        assert!(super::is_redline_backed_path("/x/A001.R3D"));
        assert!(super::is_redline_backed_path("/x/A001.nev"));
        assert!(super::is_resolve_backed_path("/x/A001.crm"));
        assert!(super::is_resolve_backed_path("/x/A001.xocn"));
        assert!(super::is_arriraw_path("/x/A001.ari"));
        assert!(super::is_arriraw_path("/x/A001.ARX"));
        assert!(super::is_arri_mxf_container_path("/x/A001.mxf"));
        assert!(!super::is_arri_mxf_container_path("/x/A001.mov"));
        assert!(super::is_decoder_backed_raw_path("/x/A001.r3d"));
        assert!(super::is_decoder_backed_raw_path("/x/A001.CRM"));
        assert!(super::is_decoder_backed_raw_path("/x/A001.ari"));
        assert!(!super::is_decoder_backed_raw_path("/x/A001.mov"));
        assert!(!super::is_redline_backed_path("/x/A001.braw"));
    }

    #[test]
    fn locate_art_cmd_finds_binary_in_override_dir() {
        let dir = std::env::temp_dir().join(format!("cineflow_art_{}", std::process::id()));
        let bin_dir = dir.join("Contents").join("MacOS");
        std::fs::create_dir_all(&bin_dir).unwrap();
        let bin = bin_dir.join("art-cmd");
        std::fs::write(&bin, "#!/bin/sh\n").unwrap();
        let found = super::locate_art_cmd(Some(&dir.to_string_lossy()));
        assert_eq!(found.as_deref(), Some(bin.to_string_lossy().as_ref()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn locate_redline_finds_binary_in_override_dir() {
        let dir = std::env::temp_dir().join(format!("cineflow_red_{}", std::process::id()));
        let bin_dir = dir.join("bin");
        std::fs::create_dir_all(&bin_dir).unwrap();
        let bin = bin_dir.join("REDline");
        std::fs::write(&bin, "#!/bin/sh\n").unwrap();
        let found = super::locate_redline(Some(&dir.to_string_lossy()));
        // A real REDline on PATH would be picked first; otherwise our fixture wins.
        assert!(found.is_some());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
