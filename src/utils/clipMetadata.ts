import { Clip } from "../types";

interface MetadataTag {
  label: string;
  value: string;
  highlight?: boolean;
}

const CODEC_LABELS: Record<string, string> = {
  av1: "AV1",
  braw: "BRAW",
  dnxhd: "DNxHD",
  dnxhr: "DNxHR",
  h264: "H.264",
  "avc1": "H.264",
  h265: "HEVC",
  hevc: "HEVC",
  mpeg4: "MPEG-4",
  prores: "ProRes",
  prores_ks: "ProRes",
  vp9: "VP9",
};

export function formatCodecLabel(clip: Pick<Clip, "video_codec" | "filename" | "file_path">): string {
  const codecRaw = (clip.video_codec || "").trim().toLowerCase();
  const extension = getFileExtension(clip.filename, clip.file_path);

  if (extension === "braw") return "BRAW";
  if (codecRaw && CODEC_LABELS[codecRaw]) return CODEC_LABELS[codecRaw];
  if (codecRaw) return codecRaw.toUpperCase();
  return "—";
}

export function formatTimecode(rawTc: string | null | undefined): string | null {
  const tc = (rawTc || "").trim();
  if (!tc) return null;
  if (/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(tc)) return tc;
  if (tc.length <= 16) return tc;
  return null;
}

export function formatContainerLabel(clip: Pick<Clip, "format_name" | "filename" | "file_path">): string {
  const extension = getFileExtension(clip.filename, clip.file_path);
  if (extension === "braw") return "BRAW";

  const formatRaw = (clip.format_name || "").trim().toLowerCase();
  const formatTokens = formatRaw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (extension && formatTokens.includes(extension)) return extension.toUpperCase();
  if (formatTokens.length > 0 && formatTokens[0] !== "unknown") return formatTokens[0].toUpperCase();
  if (extension) return extension.toUpperCase();
  return "—";
}

export function buildClipMetadataTags(clip: Clip, audioBadge: string | null): MetadataTag[] {
  const tags: MetadataTag[] = [];

  tags.push({ label: "DUR", value: formatDuration(clip.duration_ms) });
  tags.push({ label: "FMT", value: formatContainerLabel(clip) });
  tags.push({ label: "CODEC", value: formatCodecLabel(clip) });

  const iso = parseNumberLike(clip.camera_iso);
  if (iso) tags.push({ label: "ISO", value: `ISO ${iso}` });

  const wb = parseNumberLike(clip.camera_white_balance);
  if (wb) tags.push({ label: "WB", value: `WB ${wb}K` });

  if (clip.camera_lens) tags.push({ label: "LENS", value: clip.camera_lens });
  if (clip.camera_aperture) tags.push({ label: "APT", value: clip.camera_aperture });
  if (clip.camera_angle) tags.push({ label: "ANG", value: clip.camera_angle });

  const tc = formatTimecode(clip.timecode);
  if (tc) tags.push({ label: "TC", value: `TC ${tc}` });

  if (clip.video_bitrate > 0) {
    tags.push({ label: "BR", value: `${Math.round(clip.video_bitrate / 1_000_000)} Mbps`, highlight: true });
  }

  if (audioBadge) {
    tags.push({ label: "AUDIO", value: audioBadge });
  }

  tags.push({ label: "RES", value: clip.width > 0 ? `${clip.width}×${clip.height}` : "—" });
  tags.push({ label: "FPS", value: clip.fps > 0 ? `${clip.fps}` : "—" });
  tags.push({ label: "SIZE", value: formatFileSize(clip.size_bytes) });

  return tags;
}

export function getAudioBadge(summary: string | undefined, envelope?: number[]): string | null {
  if (!summary || summary.toLowerCase().includes("no audio")) return "NO AUDIO";
  if (!envelope || envelope.length === 0) return "AUDIO";
  const peak = Math.max(...envelope);
  const silentRatio = envelope.filter((v) => v < 20).length / envelope.length;
  if (peak >= 245) return "POSSIBLE CLIP";
  if (silentRatio > 0.85) return "VERY LOW";
  return "AUDIO OK";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i < 0) return "0 B";
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function parseNumberLike(value: string | null | undefined): string | null {
  const raw = (value || "").trim();
  if (!raw) return null;
  const match = raw.match(/\d{2,6}/);
  if (match) return match[0];
  return null;
}

function getFileExtension(filename: string, filePath: string): string | null {
  const source = filename || filePath || "";
  const dot = source.lastIndexOf(".");
  if (dot < 0 || dot === source.length - 1) return null;
  return source.slice(dot + 1).toLowerCase();
}
