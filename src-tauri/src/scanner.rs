use std::path::Path;
use walkdir::WalkDir;

/// Supported media file extensions (video + image)
const MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "mxf", "avi", "mkv", "prores", "r3d", "braw", "nev", "mts", "m4v", "webm", "wmv",
    "flv", "ts", "m2ts", "mpg", "mpeg", "3gp", "3gp2", "ogv", "vob", "divx", "xvid", "mqv", "jpg",
    "jpeg", "png", "webp", "tiff", "tif", "bmp", "heic", "heif", "dng", "arw", "cr2", "cr3", "nef",
    "nrw", "raf", "rw2", "orf", "srf", "sr2", "pef", "srw", "raw", "rwl", "iiq", "xocn", "crm",
    "rmf",
];

/// Scan a directory recursively and return all supported media file paths
pub fn scan_folder(root: &str, cancel_flag: Option<&std::sync::atomic::AtomicBool>) -> Vec<String> {
    let mut media_files: Vec<String> = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if let Some(cf) = cancel_flag {
            if cf.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
        }
        let path = entry.path();
        if path.is_file() && is_supported_media_file(path) {
            if let Some(path_str) = path.to_str() {
                media_files.push(path_str.to_string());
            }
        }
    }

    media_files.sort();
    media_files
}

fn is_supported_media_file(path: &Path) -> bool {
    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        if name.starts_with("._") {
            return false;
        }
    }
    if let Some(ext) = path.extension() {
        let ext_lower = ext.to_string_lossy().to_lowercase();
        MEDIA_EXTENSIONS.contains(&ext_lower.as_str())
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::is_supported_media_file;
    use std::path::Path;

    #[test]
    fn accepts_open_camera_raw_extensions() {
        for extension in [
            "dng", "arw", "cr2", "cr3", "nef", "nrw", "raf", "rw2", "orf", "srf", "sr2", "pef",
            "srw", "raw", "rwl", "iiq",
        ] {
            let path = format!("/clip/A001.{extension}");

            assert!(
                is_supported_media_file(Path::new(&path)),
                "expected {extension} to be scanned as media"
            );
        }
    }

    #[test]
    fn accepts_proxy_guided_cinema_raw_extensions() {
        for extension in ["xocn", "crm", "rmf"] {
            let path = format!("/clip/A001.{extension}");

            assert!(
                is_supported_media_file(Path::new(&path)),
                "expected {extension} to be scanned as media"
            );
        }
    }
}
