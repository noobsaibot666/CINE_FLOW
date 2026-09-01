//! Decoder availability for Camera Match Lab.
//!
//! Camera RAW analysis needs a decode provider per format. Some providers ship
//! with the app (FFmpeg, LibRaw, the bundled BRAW bridge); others the user must
//! install (RED R3D SDK) or already has (DaVinci Resolve). This module reports,
//! per format family, whether analysis can proceed and — when it can't — exactly
//! what the user should download or point us at, so the UI never dead-ends.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// User-provided locations for decoders we can't bundle. Persisted as
/// `decoders.json` in the app data dir.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct DecoderOverrides {
    /// Directory that contains `Libraries/BlackmagicRawAPI.framework` (macOS) or
    /// the BRAW SDK runtime (Windows).
    pub braw_sdk_dir: Option<String>,
    /// Directory of an installed RED R3D SDK / REDline.
    pub red_sdk_dir: Option<String>,
    /// Path to a DaVinci Resolve application / executable.
    pub resolve_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecoderSetup {
    pub download_url: Option<String>,
    pub download_label: Option<String>,
    pub steps: Vec<String>,
    /// What the "Locate…" picker should point at, and which override key to save.
    pub locate_key: Option<String>,
    pub locate_kind: Option<String>, // "directory" | "app" | "file"
    pub locate_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecoderStatus {
    /// Matches `ProductionMediaCapabilityReport::format_family`.
    pub family: String,
    pub label: String,
    /// "available" | "needs_setup" | "unavailable"
    pub state: String,
    /// "ffmpeg" | "libraw" | "bundled_bridge" | "homebrew" | "red_sdk" |
    /// "resolve" | "operator_proxy"
    pub provider: Option<String>,
    pub detail: String,
    pub version: Option<String>,
    pub path: Option<String>,
    pub setup: Option<DecoderSetup>,
}

fn available(family: &str, label: &str, provider: &str, detail: &str) -> DecoderStatus {
    DecoderStatus {
        family: family.into(),
        label: label.into(),
        state: "available".into(),
        provider: Some(provider.into()),
        detail: detail.into(),
        version: None,
        path: None,
        setup: None,
    }
}

fn needs_setup(family: &str, label: &str, detail: &str, setup: DecoderSetup) -> DecoderStatus {
    DecoderStatus {
        family: family.into(),
        label: label.into(),
        state: "needs_setup".into(),
        provider: None,
        detail: detail.into(),
        version: None,
        path: None,
        setup: Some(setup),
    }
}

pub fn overrides_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("decoders.json")
}

pub fn load_overrides(app_data_dir: &Path) -> DecoderOverrides {
    std::fs::read_to_string(overrides_path(app_data_dir))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn save_overrides(app_data_dir: &Path, overrides: &DecoderOverrides) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| format!("Could not create app data dir: {e}"))?;
    let json = serde_json::to_string_pretty(overrides).map_err(|e| e.to_string())?;
    std::fs::write(overrides_path(app_data_dir), json).map_err(|e| e.to_string())
}

/// Best-effort DaVinci Resolve detection. Resolve decodes every cinema RAW
/// format natively and can be driven headless, so it is our universal fallback.
pub fn detect_resolve(overrides: &DecoderOverrides) -> Option<String> {
    if let Some(path) = overrides.resolve_path.as_deref() {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    let candidates: &[&str] = if cfg!(target_os = "macos") {
        &[
            "/Applications/DaVinci Resolve/DaVinci Resolve.app",
            "/Applications/DaVinci Resolve.app",
        ]
    } else if cfg!(target_os = "windows") {
        &[
            "C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\Resolve.exe",
        ]
    } else {
        &["/opt/resolve/bin/resolve", "/usr/bin/resolve"]
    };
    candidates
        .iter()
        .find(|c| Path::new(c).exists())
        .map(|c| c.to_string())
}

fn resolve_setup() -> DecoderSetup {
    DecoderSetup {
        download_url: Some("https://www.blackmagicdesign.com/products/davinciresolve".into()),
        download_label: Some("Download DaVinci Resolve (free)".into()),
        steps: vec![
            "Install DaVinci Resolve (free) and keep it open while generating a proxy.".into(),
            "Then press Re-check.".into(),
        ],
        locate_key: Some("resolve_path".into()),
        locate_kind: Some(if cfg!(target_os = "macos") { "app" } else { "file" }.into()),
        locate_hint: Some("Pick the DaVinci Resolve app if it's not in the default location.".into()),
    }
}

fn red_setup() -> DecoderSetup {
    DecoderSetup {
        download_url: Some("https://www.red.com/downloads".into()),
        download_label: Some("Get REDCINE-X PRO or the R3D SDK (free)".into()),
        steps: vec![
            "Install REDCINE-X PRO (free) — CineFlow auto-detects its REDline.".into(),
            "Or press Locate… and pick an unzipped R3D SDK folder.".into(),
            "Or keep DaVinci Resolve open — it decodes R3D with no RED install.".into(),
        ],
        locate_key: Some("red_sdk_dir".into()),
        locate_kind: Some("directory".into()),
        locate_hint: Some("Pick the R3D SDK folder (has Redistributable/ and Include/), or the REDCINE-X PRO app.".into()),
    }
}

fn braw_setup() -> DecoderSetup {
    DecoderSetup {
        download_url: Some("https://www.blackmagicdesign.com/developer/products/braw".into()),
        download_label: Some("Get the free Blackmagic RAW SDK".into()),
        steps: vec![
            "Install the Blackmagic RAW SDK (or `brew install --cask blackmagic-raw` on macOS).".into(),
            "Or press Locate… and pick a folder that contains Libraries/BlackmagicRawAPI.framework.".into(),
            "Press Re-check.".into(),
        ],
        locate_key: Some("braw_sdk_dir".into()),
        locate_kind: Some("directory".into()),
        locate_hint: Some("Pick a folder that contains Libraries/BlackmagicRawAPI.framework.".into()),
    }
}

fn braw_sdk_in_dir(dir: &str) -> bool {
    Path::new(dir)
        .join("Libraries")
        .join("BlackmagicRawAPI.framework")
        .exists()
}

fn red_sdk_in_dir(dir: &str) -> bool {
    let base = Path::new(dir);
    base.join("Redistributable").exists() || base.join("Include").join("R3DSDK.h").exists()
}

fn ffmpeg_major_version() -> Option<u32> {
    let ffmpeg = crate::tools::find_executable("ffmpeg");
    let out = std::process::Command::new(&ffmpeg).arg("-version").output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    // "ffmpeg version 7.1 ..." / "ffmpeg version n8.0 ..." / "... 8.0-static ..."
    let token = text.split_whitespace().nth(2)?;
    let digits: String = token
        .trim_start_matches(|c: char| !c.is_ascii_digit())
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    digits.parse().ok()
}

/// Full decoder inventory for the Decoder Setup panel.
pub fn probe_all_decoders(app_data_dir: &Path, resource_dir: Option<&Path>) -> Vec<DecoderStatus> {
    let overrides = load_overrides(app_data_dir);
    let resolve = detect_resolve(&overrides);

    vec![
        probe_braw(&overrides, resource_dir),
        probe_red(&overrides, resolve.as_deref()),
        probe_via_resolve_or_proxy("CANON_CINEMA_RAW", "Canon Cinema RAW Light", resolve.as_deref()),
        probe_via_resolve_or_proxy("SONY_XOCN", "Sony X-OCN", resolve.as_deref()),
        probe_via_resolve_or_proxy("ARRIRAW", "ARRIRAW", resolve.as_deref()),
        probe_prores_raw(),
        probe_resolve(resolve.as_deref()),
    ]
}

/// The decoder status for one capability report's `format_family`.
pub fn probe_decoder_for_family(
    family: &str,
    app_data_dir: &Path,
    resource_dir: Option<&Path>,
) -> Option<DecoderStatus> {
    let overrides = load_overrides(app_data_dir);
    let resolve = detect_resolve(&overrides);
    match family {
        "BLACKMAGIC_RAW" => Some(probe_braw(&overrides, resource_dir)),
        "RED_R3D" | "NIKON_NRAW" => Some(probe_red(&overrides, resolve.as_deref())),
        "CANON_CINEMA_RAW" => Some(probe_via_resolve_or_proxy(family, "Canon Cinema RAW Light", resolve.as_deref())),
        "SONY_XOCN" => Some(probe_via_resolve_or_proxy(family, "Sony X-OCN", resolve.as_deref())),
        "ARRIRAW" => Some(probe_via_resolve_or_proxy(family, "ARRIRAW", resolve.as_deref())),
        "PRORES_RAW" => Some(probe_prores_raw()),
        _ => None,
    }
}

fn probe_braw(overrides: &DecoderOverrides, resource_dir: Option<&Path>) -> DecoderStatus {
    let caps = crate::production_match_lab::probe_braw_decoder(resource_dir);
    if caps.found {
        let mut s = available(
            "BLACKMAGIC_RAW",
            "Blackmagic RAW",
            "bundled_bridge",
            "BRAW bridge and SDK detected — .braw analyses directly.",
        );
        s.path = caps.executable_path;
        s.version = caps.version;
        return s;
    }
    if let Some(dir) = overrides.braw_sdk_dir.as_deref() {
        if braw_sdk_in_dir(dir) {
            let mut s = available(
                "BLACKMAGIC_RAW",
                "Blackmagic RAW",
                "bundled_bridge",
                "Using the Blackmagic RAW SDK from your configured folder.",
            );
            s.path = Some(dir.to_string());
            return s;
        }
    }
    needs_setup(
        "BLACKMAGIC_RAW",
        "Blackmagic RAW",
        "The Blackmagic RAW SDK isn't present in this build. Install it (free) or point us at it.",
        braw_setup(),
    )
}

const RED_LABEL: &str = "RED R3D / R3D NE / Nikon N-RAW";

fn locate_red_binary() -> Option<String> {
    for name in ["red_bridge", "REDline", "redline"] {
        let path = crate::tools::find_executable(name);
        if path != name && Path::new(&path).exists() {
            return Some(path);
        }
    }
    None
}

/// Is `path` an arm64 (or universal) Mach-O? The bundled REDline is Intel-only.
fn macho_is_arm64_or_universal(path: &str) -> bool {
    use std::io::Read;
    let mut header = [0u8; 8];
    if std::fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut header))
        .is_err()
    {
        return false;
    }
    let magic = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
    // Fat/universal binary — assume it carries an arm64 slice.
    if magic == 0xCAFE_BABE || magic == 0xBEBA_FECA {
        return true;
    }
    let cputype = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
    magic == 0xFEED_FACF && cputype == 0x0100_000C // MH_MAGIC_64 + CPU_TYPE_ARM64
}

fn rosetta_available() -> bool {
    #[cfg(target_arch = "aarch64")]
    {
        Path::new("/Library/Apple/usr/libexec/oah/libRosettaRuntime").exists()
    }
    #[cfg(not(target_arch = "aarch64"))]
    {
        true
    }
}

/// Can this REDline actually execute on the host? On Apple Silicon an Intel
/// REDline needs Rosetta 2.
fn red_binary_runnable(path: &str) -> bool {
    #[cfg(target_arch = "aarch64")]
    {
        macho_is_arm64_or_universal(path) || rosetta_available()
    }
    #[cfg(not(target_arch = "aarch64"))]
    {
        let _ = path;
        true
    }
}

/// Pure decision so it can be unit-tested without touching PATH.
fn decide_red(
    bridge_path: Option<String>,
    red_sdk_dir_valid: bool,
    red_sdk_dir: Option<&str>,
    resolve: Option<&str>,
) -> DecoderStatus {
    if let Some(path) = bridge_path {
        if !red_binary_runnable(&path) {
            return needs_setup(
                "RED_R3D",
                RED_LABEL,
                "The bundled REDline is an Intel binary and Rosetta 2 is missing. In Terminal run `softwareupdate --install-rosetta --agree-to-license`, or install REDCINE-X PRO (native Apple Silicon), then Re-check.",
                red_setup(),
            );
        }
        let mut s = available("RED_R3D", RED_LABEL, "red_sdk", "RED decoder detected — .r3d and .nev analyse directly.");
        s.path = Some(path);
        return s;
    }
    if red_sdk_dir_valid {
        let mut s = available("RED_R3D", RED_LABEL, "red_sdk", "Using the RED R3D SDK from your configured folder.");
        s.path = red_sdk_dir.map(str::to_string);
        return s;
    }
    if resolve.is_some() {
        return DecoderStatus {
            family: "RED_R3D".into(),
            label: RED_LABEL.into(),
            state: "available".into(),
            provider: Some("resolve".into()),
            detail: "No RED SDK, but DaVinci Resolve is installed and can build the analysis proxy.".into(),
            version: None,
            path: None,
            setup: Some(red_setup()),
        };
    }
    needs_setup(
        "RED_R3D",
        RED_LABEL,
        "Needs the free RED R3D SDK, or an installed DaVinci Resolve.",
        red_setup(),
    )
}

fn probe_red(overrides: &DecoderOverrides, resolve: Option<&str>) -> DecoderStatus {
    let dir = overrides.red_sdk_dir.as_deref();
    decide_red(
        locate_red_binary(),
        dir.map(red_sdk_in_dir).unwrap_or(false),
        dir,
        resolve,
    )
}

fn decide_resolve_or_proxy(family: &str, label: &str, resolve: Option<&str>) -> DecoderStatus {
    if resolve.is_some() {
        return available(
            family,
            label,
            "resolve",
            "Decodes through DaVinci Resolve — keep Resolve open when generating a proxy, or attach an MP4/ProRes proxy.",
        );
    }
    needs_setup(
        family,
        label,
        "Needs DaVinci Resolve (free) open during proxy generation, or an attached MP4/ProRes proxy.",
        resolve_setup(),
    )
}

fn probe_via_resolve_or_proxy(family: &str, label: &str, resolve: Option<&str>) -> DecoderStatus {
    decide_resolve_or_proxy(family, label, resolve)
}

fn probe_prores_raw() -> DecoderStatus {
    match ffmpeg_major_version() {
        Some(v) if v >= 8 => {
            let mut s = available(
                "PRORES_RAW",
                "Apple ProRes RAW",
                "ffmpeg",
                "FFmpeg 8+ detected — ProRes RAW decodes directly.",
            );
            s.version = Some(v.to_string());
            s
        }
        Some(v) => {
            let mut s = needs_setup(
                "PRORES_RAW",
                "Apple ProRes RAW",
                &format!("FFmpeg {v} is bundled; ProRes RAW decode needs FFmpeg 8 or newer."),
                DecoderSetup {
                    download_url: None,
                    download_label: None,
                    steps: vec!["This is a bundled component — a future CineFlow update ships FFmpeg 8.".into()],
                    locate_key: None,
                    locate_kind: None,
                    locate_hint: None,
                },
            );
            s.version = Some(v.to_string());
            s
        }
        None => available("PRORES_RAW", "Apple ProRes RAW", "operator_proxy", "FFmpeg version could not be read."),
    }
}

fn probe_resolve(resolve: Option<&str>) -> DecoderStatus {
    match resolve {
        Some(path) => {
            let mut s = available(
                "RESOLVE",
                "DaVinci Resolve (universal fallback)",
                "resolve",
                "Installed. Decodes R3D / CRM / X-OCN / ARRIRAW — keep it open while a proxy is generated.",
            );
            s.path = Some(path.to_string());
            s.setup = Some(resolve_setup());
            s
        }
        None => needs_setup(
            "RESOLVE",
            "DaVinci Resolve (universal fallback)",
            "Not detected. Installing it (free) covers every cinema RAW format.",
            resolve_setup(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overrides_round_trip() {
        let dir = std::env::temp_dir().join(format!("cineflow_dec_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let mut o = DecoderOverrides::default();
        o.red_sdk_dir = Some("/tmp/R3DSDK".into());
        save_overrides(&dir, &o).unwrap();
        let back = load_overrides(&dir);
        assert_eq!(back.red_sdk_dir.as_deref(), Some("/tmp/R3DSDK"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn red_uses_bridge_when_present() {
        let s = decide_red(Some("/x/red_bridge".into()), false, None, None);
        assert_eq!(s.state, "available");
        assert_eq!(s.provider.as_deref(), Some("red_sdk"));
    }

    #[test]
    fn red_falls_back_to_resolve_when_no_sdk() {
        let s = decide_red(None, false, None, Some("/Applications/DaVinci Resolve/DaVinci Resolve.app"));
        assert_eq!(s.state, "available");
        assert_eq!(s.provider.as_deref(), Some("resolve"));
    }

    #[test]
    fn red_needs_setup_with_nothing_available() {
        let s = decide_red(None, false, None, None);
        assert_eq!(s.state, "needs_setup");
        assert!(s.setup.unwrap().download_url.unwrap().contains("red.com"));
    }

    #[test]
    fn canon_needs_resolve_or_proxy() {
        let with = decide_resolve_or_proxy("CANON_CINEMA_RAW", "Canon Cinema RAW Light", Some("/x"));
        assert_eq!(with.state, "available");
        let without = decide_resolve_or_proxy("CANON_CINEMA_RAW", "Canon Cinema RAW Light", None);
        assert_eq!(without.state, "needs_setup");
    }
}
