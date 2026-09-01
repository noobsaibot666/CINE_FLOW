use crate::db::Clip;
use chrono::{DateTime, NaiveDateTime, Utc};
use std::collections::{BTreeMap, HashMap};
use std::fmt::Write;
use std::path::Path;

struct Rational {
    num: i64,
    den: i64,
}

impl Rational {
    fn from_ms(ms: u64) -> Self {
        Self {
            num: ms as i64,
            den: 1000,
        }
    }

    fn as_fcpxml(&self) -> String {
        format!("{}/{}s", self.num, self.den)
    }
}

/// FCP is strict about `frameDuration` — it must be a standard timebase, not an
/// arbitrary 1/fps rational, or the format (and every clip on it) is rejected.
fn fcpxml_frame_duration(fps: f64) -> String {
    const STANDARD: &[(f64, &str)] = &[
        (23.976, "1001/24000s"),
        (24.0, "1/24s"),
        (25.0, "1/25s"),
        (29.97, "1001/30000s"),
        (30.0, "1/30s"),
        (47.952, "1001/48000s"),
        (48.0, "1/48s"),
        (50.0, "1/50s"),
        (59.94, "1001/60000s"),
        (60.0, "1/60s"),
        (23.98, "1001/24000s"),
        (29.976, "1001/30000s"),
    ];
    for (rate, value) in STANDARD {
        if (fps - rate).abs() < 0.03 {
            return (*value).to_string();
        }
    }
    if fps > 0.0 {
        format!("100/{}s", (fps * 100.0).round() as i64)
    } else {
        "1/30s".to_string()
    }
}

/// Turn an absolute filesystem path into a `file://` URI that FCP / Resolve can
/// actually relink — everything outside the unreserved set is percent-encoded,
/// path separators are kept.
fn path_to_file_uri(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let mut out = String::from("file://");
    if !normalized.starts_with('/') {
        out.push('/');
    }
    for byte in normalized.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                out.push(*byte as char)
            }
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

pub fn generate_fcpxml_structured(
    clips: &[Clip],
    project_name: &str,
    include_master_timeline: bool,
    base_path: Option<&str>,
) -> String {
    let mut xml = String::new();
    let mut clips_ordered = clips.to_vec();
    clips_ordered.sort_by_key(|c| (clip_timestamp(c).unwrap_or(0), c.filename.clone()));

    let mut asset_ref_map: HashMap<String, String> = HashMap::new();
    let mut format_map: HashMap<String, String> = HashMap::new();
    let mut format_counter = 1;

    let _ = write!(xml, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    let _ = write!(xml, "<!DOCTYPE fcpxml>\n");
    let _ = write!(xml, "<fcpxml version=\"1.10\">\n");
    let _ = write!(xml, "  <resources>\n");

    for (idx, clip) in clips_ordered.iter().enumerate() {
        let format_key = format!("{}x{}@{}", clip.width, clip.height, clip.fps);
        let format_id = if let Some(existing) = format_map.get(&format_key) {
            existing.clone()
        } else {
            let fid = format!("f{}", format_counter);
            format_counter += 1;
            let frame_duration = fcpxml_frame_duration(clip.fps);
            let _ = write!(
                xml,
                "    <format id=\"{}\" name=\"{}\" frameDuration=\"{}\" width=\"{}\" height=\"{}\" />\n",
                fid, format_key, frame_duration, clip.width, clip.height
            );
            format_map.insert(format_key, fid.clone());
            fid
        };

        let asset_id = format!("r{}", idx + 1);
        asset_ref_map.insert(clip.id.clone(), asset_id.clone());
        let duration = Rational::from_ms(clip.duration_ms).as_fcpxml();

        // FCPXML 1.9+ requires the source URI inside a <media-rep>, not as a
        // bare src= attribute on <asset> (which makes FCP reject the file).
        // Percent-encode the path so spaces / unicode don't break relinking.
        let src = if let Some(bp) = base_path {
            match Path::new(&clip.file_path).strip_prefix(bp) {
                Ok(rel) => {
                    // Relative URI resolved against the .fcpxml location.
                    let rel = rel.to_string_lossy().replace('\\', "/");
                    rel.as_bytes()
                        .iter()
                        .map(|b| match b {
                            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                                (*b as char).to_string()
                            }
                            _ => format!("%{:02X}", b),
                        })
                        .collect::<String>()
                }
                Err(_) => path_to_file_uri(&clip.file_path),
            }
        } else {
            path_to_file_uri(&clip.file_path)
        };

        let _ = write!(
            xml,
            "    <asset id=\"{}\" name=\"{}\" start=\"0s\" duration=\"{}\" hasVideo=\"1\" hasAudio=\"1\" format=\"{}\">\n      <media-rep kind=\"original-media\" src=\"{}\" />\n    </asset>\n",
            asset_id,
            escape_xml(&clip.filename),
            duration,
            format_id,
            escape_xml(&src)
        );
    }

    let _ = write!(xml, "  </resources>\n");
    let _ = write!(xml, "  <library>\n");

    let block_groups = build_block_groups(&clips_ordered);
    write_block_bins(
        &mut xml,
        project_name,
        &block_groups,
        &asset_ref_map,
        &format_map,
    );
    write_camera_bins(
        &mut xml,
        project_name,
        &clips_ordered,
        &asset_ref_map,
        &format_map,
    );
    write_select_bins(
        &mut xml,
        project_name,
        &clips_ordered,
        &asset_ref_map,
        &format_map,
    );
    if include_master_timeline {
        let _ = write!(xml, "    <event name=\"04_MASTER\">\n");
        write_project_sequence(
            &mut xml,
            &format!("{}_Master", project_name),
            &clips_ordered,
            &asset_ref_map,
            &format_map,
        );
        let _ = write!(xml, "    </event>\n");
    }

    let _ = write!(xml, "  </library>\n");
    let _ = write!(xml, "</fcpxml>\n");
    xml
}

fn write_block_bins(
    xml: &mut String,
    project_name: &str,
    groups: &[(String, Vec<Clip>)],
    asset_ref_map: &HashMap<String, String>,
    format_map: &HashMap<String, String>,
) {
    let _ = write!(xml, "    <event name=\"01_BLOCKS\">\n");
    for (name, clips) in groups {
        write_project_sequence(
            xml,
            &format!("{}_{}", project_name, name),
            clips,
            asset_ref_map,
            format_map,
        );
    }
    let _ = write!(xml, "    </event>\n");
}

fn write_camera_bins(
    xml: &mut String,
    project_name: &str,
    clips: &[Clip],
    asset_ref_map: &HashMap<String, String>,
    format_map: &HashMap<String, String>,
) {
    let mut by_camera: BTreeMap<String, Vec<Clip>> = BTreeMap::new();
    for clip in clips {
        let cam = infer_camera_label(&clip.filename).unwrap_or_else(|| "Unknown".to_string());
        by_camera.entry(cam).or_default().push(clip.clone());
    }
    let _ = write!(xml, "    <event name=\"02_CAMERAS\">\n");
    for (cam, cam_clips) in by_camera {
        write_project_sequence(
            xml,
            &format!("{}_Cam_{}", project_name, cam),
            &cam_clips,
            asset_ref_map,
            format_map,
        );
    }
    let _ = write!(xml, "    </event>\n");
}

fn write_select_bins(
    xml: &mut String,
    project_name: &str,
    clips: &[Clip],
    asset_ref_map: &HashMap<String, String>,
    format_map: &HashMap<String, String>,
) {
    let picks: Vec<Clip> = clips.iter().filter(|c| c.flag == "pick").cloned().collect();
    let _ = write!(xml, "    <event name=\"03_SELECTS\">\n");
    if !picks.is_empty() {
        write_project_sequence(
            xml,
            &format!("{}_Picks", project_name),
            &picks,
            asset_ref_map,
            format_map,
        );
    }
    for rating in (1..=5).rev() {
        let rated: Vec<Clip> = clips
            .iter()
            .filter(|c| c.rating == rating)
            .cloned()
            .collect();
        if !rated.is_empty() {
            write_project_sequence(
                xml,
                &format!("{}_Rating_{}", project_name, rating),
                &rated,
                asset_ref_map,
                format_map,
            );
        }
    }
    let _ = write!(xml, "    </event>\n");
}

fn write_project_sequence(
    xml: &mut String,
    project_name: &str,
    clips: &[Clip],
    asset_ref_map: &HashMap<String, String>,
    format_map: &HashMap<String, String>,
) {
    if clips.is_empty() {
        return;
    }
    let seq_format = clips
        .first()
        .and_then(|first| {
            format_map.get(&format!("{}x{}@{}", first.width, first.height, first.fps))
        })
        .cloned()
        .unwrap_or_else(|| "f1".to_string());
    let total_duration_ms: u64 = clips.iter().map(|c| c.duration_ms).sum();
    let _ = write!(
        xml,
        "      <project name=\"{}\">\n        <sequence format=\"{}\" duration=\"{}\" tcStart=\"0s\" tcFormat=\"NDF\" name=\"{}\">\n          <spine>\n",
        escape_xml(project_name),
        seq_format,
        Rational::from_ms(total_duration_ms).as_fcpxml(),
        escape_xml(project_name)
    );

    let mut offset_ms: u64 = 0;
    for clip in clips {
        if let Some(asset_ref) = asset_ref_map.get(&clip.id) {
            let duration = Rational::from_ms(clip.duration_ms).as_fcpxml();
            let offset = Rational::from_ms(offset_ms).as_fcpxml();
            // Markers must carry a duration on the clip's timebase, not a fixed
            // 1/30s that isn't a whole frame at 24/25p.
            let mk = fcpxml_frame_duration(clip.fps);
            let _ = write!(
                xml,
                "            <asset-clip name=\"{}\" ref=\"{}\" offset=\"{}\" duration=\"{}\" start=\"0s\">\n",
                escape_xml(&clip.filename),
                asset_ref,
                offset,
                duration
            );
            if clip.flag == "pick" {
                let _ = write!(
                    xml,
                    "              <keyword start=\"0s\" duration=\"{}\" value=\"Pick\" />\n              <marker start=\"0s\" duration=\"{}\" value=\"PICK\" completed=\"1\" />\n",
                    duration, mk
                );
            } else if clip.flag == "reject" {
                let _ = write!(
                    xml,
                    "              <keyword start=\"0s\" duration=\"{}\" value=\"Reject\" />\n              <marker start=\"0s\" duration=\"{}\" value=\"REJECT\" completed=\"1\" />\n",
                    duration, mk
                );
            }
            if clip.rating > 0 {
                let _ = write!(
                    xml,
                    "              <keyword start=\"0s\" duration=\"{}\" value=\"Rating {}\" />\n              <marker start=\"0s\" duration=\"{}\" value=\"Rating {}\" completed=\"1\" />\n",
                    duration, clip.rating, mk, clip.rating
                );
            }
            if let Some(notes) = &clip.notes {
                if !notes.is_empty() {
                    let _ = write!(
                        xml,
                        "              <marker start=\"0s\" duration=\"{}\" value=\"{}\" />\n",
                        mk,
                        escape_xml(notes)
                    );
                }
            }
            let _ = write!(xml, "            </asset-clip>\n");
            offset_ms += clip.duration_ms;
        }
    }

    let _ = write!(
        xml,
        "          </spine>\n        </sequence>\n      </project>\n"
    );
}

fn build_block_groups(clips: &[Clip]) -> Vec<(String, Vec<Clip>)> {
    if clips.is_empty() {
        return vec![];
    }
    let mut groups: Vec<(String, Vec<Clip>)> = Vec::new();
    for clip in clips {
        if let Some((_, block_clips)) = groups.last_mut() {
            let split = match (
                block_clips.last().and_then(clip_timestamp),
                clip_timestamp(clip),
            ) {
                (Some(prev), Some(cur)) => cur - prev > 60,
                _ => false,
            };
            if split {
                let idx = groups.len() + 1;
                groups.push((format!("Block_{:02}", idx), vec![clip.clone()]));
            } else {
                block_clips.push(clip.clone());
            }
        } else {
            groups.push(("Block_01".to_string(), vec![clip.clone()]));
        }
    }
    groups
}

fn infer_camera_label(filename: &str) -> Option<String> {
    let upper = filename.to_uppercase();
    for token in upper.split(|c: char| !c.is_ascii_alphanumeric()) {
        if token == "A" || token == "B" || token == "C" || token == "D" {
            return Some(token.to_string());
        }
        if let Some(rest) = token.strip_prefix("CAM") {
            if !rest.is_empty() {
                return Some(rest.to_string());
            }
        }
    }
    None
}

fn clip_timestamp(clip: &Clip) -> Option<i64> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(&clip.created_at) {
        return Some(dt.timestamp());
    }
    if let Ok(naive) = NaiveDateTime::parse_from_str(&clip.created_at, "%Y-%m-%d %H:%M:%S") {
        return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc).timestamp());
    }
    None
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('\"', "&quot;")
        .replace('\'', "&apos;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn clip(id: &str, filename: &str, created_at: &str) -> Clip {
        Clip {
            id: id.to_string(),
            project_id: "p1".to_string(),
            root_id: "root-1".to_string(),
            rel_path: filename.to_string(),
            filename: filename.to_string(),
            file_path: format!("/Volumes/Media/{}", filename),
            size_bytes: 100,
            created_at: created_at.to_string(),
            duration_ms: 1000,
            fps: 24.0,
            width: 1920,
            height: 1080,
            video_codec: "h264".to_string(),
            video_bitrate: 100_000_000,
            format_name: "mov".to_string(),
            audio_codec: "aac".to_string(),
            audio_channels: 2,
            audio_sample_rate: 48_000,
            camera_iso: None,
            camera_white_balance: None,
            camera_lens: None,
            camera_aperture: None,
            camera_angle: None,
            audio_summary: "AAC".to_string(),
            timecode: None,
            status: "ok".to_string(),
            rating: 3,
            flag: "pick".to_string(),
            notes: Some("A&B <shot> \"ok\"".to_string()),
            shot_size: None,
            movement: None,
            manual_order: 0,
            audio_envelope: None,
            lut_enabled: 0,
        }
    }

    #[test]
    fn escapes_xml_fields() {
        let xml = generate_fcpxml_structured(
            &[clip("1", "A&B <test>.mov", "2026-01-01 10:00:00")],
            "Proj & Test",
            true,
            None,
        );
        assert!(xml.contains("A&amp;B &lt;test&gt;.mov"));
        assert!(xml.contains("Proj &amp; Test"));
        assert!(xml.contains("&quot;ok&quot;"));
    }

    #[test]
    fn asset_uses_media_rep_with_encoded_uri() {
        let mut c = clip("1", "A001 C001.mov", "2026-01-01 10:00:00");
        c.file_path = "/Volumes/CARD 01/A001 C001.mov".to_string();
        c.fps = 23.976;
        let xml = generate_fcpxml_structured(&[c], "Proj", true, None);
        assert!(xml.contains("<media-rep kind=\"original-media\""));
        assert!(!xml.contains(" src=\"file://localhost"));
        assert!(xml.contains("file:///Volumes/CARD%2001/A001%20C001.mov"));
        assert!(xml.contains("frameDuration=\"1001/24000s\""));
    }

    #[test]
    fn frame_duration_snaps_to_standard_timebases() {
        assert_eq!(fcpxml_frame_duration(23.976), "1001/24000s");
        assert_eq!(fcpxml_frame_duration(25.0), "1/25s");
        assert_eq!(fcpxml_frame_duration(29.97), "1001/30000s");
        assert_eq!(fcpxml_frame_duration(59.94), "1001/60000s");
    }

    #[test]
    fn deterministic_output_for_same_input() {
        let clips = vec![
            clip("1", "CamA_001.mov", "2026-01-01 10:00:00"),
            clip("2", "CamB_001.mov", "2026-01-01 10:00:05"),
        ];
        let xml1 = generate_fcpxml_structured(&clips, "Project", true, None);
        let xml2 = generate_fcpxml_structured(&clips, "Project", true, None);
        assert_eq!(xml1, xml2);
    }
}
