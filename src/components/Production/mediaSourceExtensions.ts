export const VIDEO_SOURCE_EXTENSIONS = [
  "mov",
  "mp4",
  "mxf",
  "mkv",
  "avi",
] as const;

export const DECODER_BACKED_RAW_EXTENSIONS = [
  "braw",
] as const;

export const VENDOR_RAW_EXTENSIONS = [
  "r3d",
  "nev",
] as const;

export const OPEN_CAMERA_RAW_EXTENSIONS = [
  "dng",
  "arw",
  "cr2",
  "cr3",
  "nef",
  "nrw",
  "raf",
  "rw2",
  "orf",
  "srf",
  "sr2",
  "pef",
  "srw",
  "raw",
  "rwl",
  "iiq",
] as const;

export const PROXY_GUIDED_RAW_EXTENSIONS = [
  "xocn",
  "crm",
  "rmf",
  "ari",
  "arx",
] as const;

// Containers that are USUALLY directly decodable but can also wrap camera RAW
// (ARRIRAW MXF). Treated as a direct source until frame extraction fails, then
// escalated to the "generate a proxy" / "attach a proxy" recovery path.
export const AMBIGUOUS_CONTAINER_EXTENSIONS = [
  "mxf",
] as const;

export const PRODUCTION_CAMERA_SOURCE_EXTENSIONS = [
  ...VIDEO_SOURCE_EXTENSIONS,
  ...DECODER_BACKED_RAW_EXTENSIONS,
  ...VENDOR_RAW_EXTENSIONS,
  ...OPEN_CAMERA_RAW_EXTENSIONS,
  ...PROXY_GUIDED_RAW_EXTENSIONS,
] as const;

export const FRAME_PREVIEW_SOURCE_EXTENSIONS = [
  ...VIDEO_SOURCE_EXTENSIONS,
  "jpg",
  "jpeg",
  "png",
  "webp",
  "tif",
  "tiff",
  "heic",
  "heif",
  ...OPEN_CAMERA_RAW_EXTENSIONS,
] as const;

export function getLowercaseExtension(path: string) {
  const match = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function hasExtension(path: string, extensions: readonly string[]) {
  return extensions.includes(getLowercaseExtension(path));
}
