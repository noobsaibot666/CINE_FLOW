//! DaVinci Resolve as a headless decode provider for cinema RAW formats that
//! have no bundled decoder (Canon CRM/RMF, Sony X-OCN, ARRIRAW).
//!
//! Resolve must be **running** — its free edition exposes the scripting API only
//! to an already-open instance. We drive it with a short Python script and hand
//! the rendered proxy back to the analysis pipeline. Every failure path returns
//! an actionable message; the caller always still has the "attach a proxy"
//! fallback.

use std::path::Path;

#[cfg(target_os = "macos")]
const DEFAULTS: ResolveEnv = ResolveEnv {
    script_api: "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting",
    script_lib: "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
};
#[cfg(target_os = "windows")]
const DEFAULTS: ResolveEnv = ResolveEnv {
    script_api: "C:\\ProgramData\\Blackmagic Design\\DaVinci Resolve\\Support\\Developer\\Scripting",
    script_lib: "C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\fusionscript.dll",
};
#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
const DEFAULTS: ResolveEnv = ResolveEnv {
    script_api: "/opt/resolve/Developer/Scripting",
    script_lib: "/opt/resolve/libs/Fusion/fusionscript.so",
};

struct ResolveEnv {
    script_api: &'static str,
    script_lib: &'static str,
}

const DRIVER_PY: &str = r#"
import sys, os, time

src, out_dir, out_name = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    import DaVinciResolveScript as dvr
except Exception as e:
    print("ERR: cannot import DaVinciResolveScript: %s" % e); sys.exit(2)

resolve = dvr.scriptapp("Resolve")
if resolve is None:
    print("ERR: DaVinci Resolve is not running"); sys.exit(3)

pm = resolve.GetProjectManager()
proj_name = "CineFlow_ProxyTmp"
proj = pm.CreateProject(proj_name) or pm.LoadProject(proj_name)
if proj is None:
    print("ERR: could not create a scratch project"); sys.exit(4)
try:
    mp = proj.GetMediaPool()
    clips = mp.ImportMedia([src])
    if not clips:
        print("ERR: Resolve could not import %s" % src); sys.exit(5)
    tl = mp.CreateTimelineFromClips("CineFlowProxy", clips)
    if tl is None:
        print("ERR: could not build a timeline"); sys.exit(6)
    proj.SetCurrentTimeline(tl)
    proj.SetRenderSettings({
        "SelectAllFrames": True,
        "TargetDir": out_dir,
        "CustomName": out_name,
        "FormatWidth": 1920,
        "FormatHeight": 1080,
    })
    proj.SetCurrentRenderFormatAndCodec("mp4", "H264")
    if not proj.AddRenderJob():
        print("ERR: AddRenderJob failed"); sys.exit(7)
    proj.StartRendering(isInteractiveMode=False)
    for _ in range(1800):  # up to 30 min
        if not proj.IsRenderingInProgress():
            break
        time.sleep(1)
    hits = [f for f in os.listdir(out_dir) if f.startswith(out_name)]
    if not hits:
        print("ERR: render produced no file"); sys.exit(8)
    print("OK: " + os.path.join(out_dir, hits[0]))
finally:
    pm.CloseProject(proj)
    pm.DeleteProject(proj_name)
"#;

fn python_bin() -> String {
    for candidate in ["python3", "python"] {
        let found = crate::tools::find_executable(candidate);
        if found != candidate || which_ok(candidate) {
            return found;
        }
    }
    "python3".to_string()
}

fn which_ok(name: &str) -> bool {
    std::process::Command::new(name)
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Render `input_path` to an mp4 proxy via a running DaVinci Resolve.
/// `output_path` is the desired final proxy file; on success the rendered file
/// is moved there.
pub fn create_proxy_via_resolve(input_path: &str, output_path: &Path) -> Result<(), String> {
    let out_dir = output_path
        .parent()
        .ok_or_else(|| "Proxy output path has no parent directory".to_string())?;
    std::fs::create_dir_all(out_dir)
        .map_err(|e| format!("Failed to prepare proxy dir: {e}"))?;
    let scratch = out_dir.join("resolve_scratch");
    let _ = std::fs::create_dir_all(&scratch);
    let script_path = scratch.join("cineflow_resolve_driver.py");
    std::fs::write(&script_path, DRIVER_PY)
        .map_err(|e| format!("Failed to write Resolve driver: {e}"))?;

    let script_api =
        std::env::var("RESOLVE_SCRIPT_API").unwrap_or_else(|_| DEFAULTS.script_api.to_string());
    let script_lib =
        std::env::var("RESOLVE_SCRIPT_LIB").unwrap_or_else(|_| DEFAULTS.script_lib.to_string());
    let modules = format!("{script_api}/Modules");
    let pythonpath = match std::env::var("PYTHONPATH") {
        Ok(existing) if !existing.is_empty() => format!("{existing}:{modules}"),
        _ => modules,
    };

    let out_name = "cineflow_resolve_proxy";
    let output = crate::tools::create_command(&python_bin())
        .env("RESOLVE_SCRIPT_API", &script_api)
        .env("RESOLVE_SCRIPT_LIB", &script_lib)
        .env("PYTHONPATH", &pythonpath)
        .arg(&script_path.to_string_lossy().to_string())
        .arg(input_path)
        .arg(&scratch.to_string_lossy().to_string())
        .arg(out_name)
        .output()
        .map_err(|e| format!("Failed to launch the Resolve driver: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let rendered = stdout
        .lines()
        .find_map(|line| line.strip_prefix("OK: "))
        .map(str::trim);

    let Some(rendered) = rendered else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let reason = stdout
            .lines()
            .find_map(|l| l.strip_prefix("ERR: "))
            .unwrap_or_else(|| if stderr.trim().is_empty() { "unknown error" } else { stderr.trim() });
        return Err(format!(
            "DaVinci Resolve could not build the proxy: {reason}\n\nMake sure DaVinci Resolve is open, then press Analyze again — or attach an MP4/ProRes proxy for this slot."
        ));
    };

    std::fs::rename(rendered, output_path)
        .or_else(|_| std::fs::copy(rendered, output_path).map(|_| ()))
        .map_err(|e| format!("Resolve rendered a proxy but it could not be moved into place: {e}"))?;
    let _ = std::fs::remove_dir_all(&scratch);
    Ok(())
}
