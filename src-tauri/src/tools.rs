use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

pub fn init(handle: AppHandle) {
    let _ = APP_HANDLE.set(handle);
}

pub fn executable_file_names_for_platform(name: &str, target: &str, is_windows: bool) -> Vec<String> {
    if is_windows {
        vec![format!("{}.exe", name), format!("{}-{}.exe", name, target)]
    } else {
        vec![name.to_string(), format!("{}-{}", name, target)]
    }
}

pub fn executable_candidate_paths(base_dir: &Path, file_names: &[String]) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let search_dirs = [
        base_dir.to_path_buf(),
        base_dir.join("resources"),
        base_dir.join("resources").join("bin"),
        base_dir.join("bin"),
    ];
    for dir in search_dirs {
        for file_name in file_names {
            candidates.push(dir.join(file_name));
        }
    }
    candidates
}

pub fn find_executable(name: &str) -> String {
    let requested_path = Path::new(name);
    if requested_path.is_absolute() || requested_path.components().count() > 1 {
        if requested_path.exists() {
            return name.to_string();
        }
    }

    // 1. Try to find as a Tauri Sidecar first
    if let Some(handle) = APP_HANDLE.get() {
        let arch = std::env::consts::ARCH;
        let os = if cfg!(target_os = "macos") {
            "apple-darwin"
        } else if cfg!(target_os = "windows") {
            "pc-windows-msvc"
        } else {
            "unknown-linux-gnu"
        };
        let target = format!("{}-{}", arch, os);
        let file_names = executable_file_names_for_platform(name, &target, cfg!(target_os = "windows"));

        // Production bundles can strip the target triple from externalBin sidecars,
        // but Windows builds may keep the target-triple filename next to the app exe.
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                for candidate in executable_candidate_paths(exe_dir, &file_names) {
                    if candidate.exists() {
                        return candidate.to_string_lossy().to_string();
                    }
                }
            }
        }

        // Dev mode: look for the triple-suffixed binary in src-tauri/bin/
        let project_root = handle
            .path()
            .app_config_dir()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_default();

        let local_bin = project_root.join("src-tauri").join("bin");

        for file_name in &file_names {
            let dev_path = local_bin.join(file_name);
            if dev_path.exists() {
                return dev_path.to_string_lossy().to_string();
            }
        }

        // Production resource dir: Tauri can place externalBin sidecars under resources.
        for file_name in &file_names {
            if let Ok(path) = handle.path().resolve(
                file_name,
                tauri::path::BaseDirectory::Resource,
            ) {
                if path.exists() {
                    return path.to_string_lossy().to_string();
                }
            }
            if let Ok(path) = handle.path().resolve(
                format!("bin/{}", file_name),
                tauri::path::BaseDirectory::Resource,
            ) {
                if path.exists() {
                    return path.to_string_lossy().to_string();
                }
            }
        }
    }

    // 2. Try PATH explicitly on Windows for diagnostics and version probes.
    #[cfg(target_os = "windows")]
    if let Ok(output) = Command::new("where").arg(name).output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            if !path.is_empty() {
                return path;
            }
        }
    }

    // 3. Try which (Unix only — `which` does not exist on Windows)
    #[cfg(not(target_os = "windows"))]
    if let Ok(output) = Command::new("which").arg(name).output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return path;
            }
        }
    }

    // 4. Check common macOS paths (legacy fallback)
    #[cfg(target_os = "macos")]
    {
        let common_paths = [
            "/usr/local/bin", 
            "/opt/homebrew/bin", 
            "/usr/bin", 
            "/bin",
            "/Applications/Adobe Premiere Pro 2024/Adobe Premiere Pro 2024.app/Contents/Plugins/Common/BRAW_Adobe_Plugin.bundle/Contents/Resources",
            "/Library/Application Support/Blackmagic Design/Blackmagic RAW"
        ];
        for path in common_paths {
            let full_path = PathBuf::from(path).join(name);
            if full_path.exists() {
                return full_path.to_string_lossy().to_string();
            }
        }
    }

    // Fallback to name and hope it's in PATH anyway
    name.to_string()
}

/// Create a process Command with the correct executable path and Windows flags.
/// This is the preferred way to spawn FFmpeg/FFprobe/REDline as it suppresses
/// the console window blizzard on Windows.
pub fn create_command(name: &str) -> Command {
    let executable = find_executable(name);

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(executable)
    }

    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new(executable);

        // Windows: suppress console window for child processes
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
}

#[cfg(test)]
mod tests {
    use super::{executable_candidate_paths, executable_file_names_for_platform, find_executable};
    use std::path::Path;

    #[test]
    fn missing_executable_lookup_does_not_recurse() {
        let missing_name = "__cineflow_missing_executable_for_lookup_test__";

        assert_eq!(find_executable(missing_name), missing_name);
    }

    #[test]
    fn absolute_executable_path_is_used_directly() {
        assert_eq!(find_executable("/bin/sh"), "/bin/sh");
    }

    #[test]
    fn windows_lookup_includes_tauri_sidecar_name() {
        let names = executable_file_names_for_platform("ffmpeg", "x86_64-pc-windows-msvc", true);

        assert!(names.contains(&"ffmpeg.exe".to_string()));
        assert!(names.contains(&"ffmpeg-x86_64-pc-windows-msvc.exe".to_string()));
    }

    #[test]
    fn candidate_paths_include_tauri_resource_layouts() {
        let names = executable_file_names_for_platform("ffmpeg", "x86_64-pc-windows-msvc", true);
        let candidates = executable_candidate_paths(Path::new("C:/Program Files/CineFlow Suite"), &names);

        assert!(candidates.iter().any(|path| path.ends_with("ffmpeg.exe")));
        assert!(candidates.iter().any(|path| path.ends_with("resources/ffmpeg-x86_64-pc-windows-msvc.exe")));
        assert!(candidates.iter().any(|path| path.ends_with("resources/bin/ffmpeg-x86_64-pc-windows-msvc.exe")));
        assert!(candidates.iter().any(|path| path.ends_with("bin/ffmpeg-x86_64-pc-windows-msvc.exe")));
    }
}
