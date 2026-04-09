import { mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { FramePreviewMedia, FrameTransform, RatioType, RATIO_VALUES } from "../../types/framePreview";

export type FramePreviewResolution = "720p" | "1080p" | "4k";
export type FramePreviewFormat = "jpg" | "png";

interface ExportFrameOptions {
  media: FramePreviewMedia;
  ratio: RatioType;
  transform: FrameTransform;
  resolution: FramePreviewResolution;
  format: FramePreviewFormat;
  videoTimeSeconds?: number;
  previewViewportWidth?: number;
  previewViewportHeight?: number;
}

function getRenderableImagePath(media: FramePreviewMedia): string {
  return media.preview_path ?? media.file_path;
}

interface ExportCanvasOptions {
  element: HTMLElement;
  width: number;
  height: number;
  format: FramePreviewFormat;
}

const RESOLUTION_WIDTHS: Record<FramePreviewResolution, number> = {
  "720p": 1280,
  "1080p": 1920,
  "4k": 3840
};

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function pathStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function getExtension(path: string): string {
  const match = path.toLowerCase().match(/\.([^.\\/]+)$/);
  return match?.[1] ?? "";
}

function getMimeType(path: string): string {
  const extension = getExtension(path);
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "mkv":
      return "video/x-matroska";
    case "mxf":
      return "application/mxf";
    default:
      return "application/octet-stream";
  }
}

function normalizeDir(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function writeDataUrl(filePath: string, dataUrl: string): Promise<void> {
  const bytes = await dataUrlToBytes(dataUrl);
  await writeFile(filePath, bytes);
}

async function createObjectUrl(path: string): Promise<string> {
  const bytes = await readFile(path);
  const blob = new Blob([bytes], { type: getMimeType(path) });
  return URL.createObjectURL(blob);
}

function mediaDrawRect(
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
  transform: FrameTransform,
  previewViewportWidth?: number,
  previewViewportHeight?: number
) {
  const containScale = Math.min(canvasWidth / mediaWidth, canvasHeight / mediaHeight);
  const finalWidth = mediaWidth * containScale * transform.scale;
  const finalHeight = mediaHeight * containScale * transform.scale;
  const viewportWidth = Math.max(previewViewportWidth ?? canvasWidth, 1);
  const viewportHeight = Math.max(previewViewportHeight ?? canvasHeight, 1);
  const offsetScaleX = canvasWidth / viewportWidth;
  const offsetScaleY = canvasHeight / viewportHeight;

  return {
    x: (canvasWidth - finalWidth) / 2 + transform.offsetX * offsetScaleX,
    y: (canvasHeight - finalHeight) / 2 + transform.offsetY * offsetScaleY,
    width: finalWidth,
    height: finalHeight
  };
}

async function loadImage(path: string): Promise<HTMLImageElement> {
  const url = await createObjectUrl(path);
  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Unable to load image: ${path}`));
      image.src = url;
    });

    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadVideo(path: string, videoTimeSeconds = 0): Promise<HTMLVideoElement> {
  const url = await createObjectUrl(path);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    const onLoadedMetadata = () => resolve();
    const onError = () => reject(new Error(`Unable to load video: ${path}`));

    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("error", onError, { once: true });
  });

  const safeTime = Number.isFinite(video.duration) ? Math.min(Math.max(videoTimeSeconds, 0), Math.max(video.duration - 0.05, 0)) : 0;

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => resolve();
    const onError = () => reject(new Error(`Unable to seek video: ${path}`));

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = safeTime;
  });

  const revoke = () => URL.revokeObjectURL(url);
  (video as HTMLVideoElement & { __framePreviewCleanup?: () => void }).__framePreviewCleanup = revoke;
  return video;
}

export function getExportDimensions(ratio: RatioType, resolution: FramePreviewResolution) {
  const width = RESOLUTION_WIDTHS[resolution];
  const height = Math.round(width / RATIO_VALUES[ratio]);
  return { width, height };
}

export async function exportFrameToDataUrl(options: ExportFrameOptions): Promise<string> {
  const { media, ratio, transform, resolution, format, videoTimeSeconds, previewViewportWidth, previewViewportHeight } = options;
  const { width, height } = getExportDimensions(ratio, resolution);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to acquire export canvas context.");
  }

  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const source = media.type === "image"
    ? await loadImage(getRenderableImagePath(media))
    : await loadVideo(media.file_path, videoTimeSeconds);

  try {
    const draw = mediaDrawRect(width, height, media.width, media.height, transform, previewViewportWidth, previewViewportHeight);
    context.drawImage(source, draw.x, draw.y, draw.width, draw.height);

    return format === "jpg"
      ? canvas.toDataURL("image/jpeg", 0.95)
      : canvas.toDataURL("image/png");
  } finally {
    (source as HTMLVideoElement & { __framePreviewCleanup?: () => void }).__framePreviewCleanup?.();
  }
}

export async function exportFrameToPath(filePath: string, options: ExportFrameOptions): Promise<void> {
  const dataUrl = await exportFrameToDataUrl(options);
  await writeDataUrl(filePath, dataUrl);
}

export async function exportCanvasElement(filePath: string, options: ExportCanvasOptions): Promise<void> {
  const { element, width, height, format } = options;
  const { toJpeg, toPng } = await import("html-to-image");
  const dataUrl = format === "jpg"
    ? await toJpeg(element, { quality: 0.95, pixelRatio: 2, canvasWidth: width, canvasHeight: height })
    : await toPng(element, { quality: 1, pixelRatio: 2, canvasWidth: width, canvasHeight: height });

  await writeDataUrl(filePath, dataUrl);
}

export async function ensureExportDirectory(parentDirectory: string, folderName: string): Promise<string> {
  const targetDirectory = `${normalizeDir(parentDirectory)}/${folderName}`;
  await mkdir(targetDirectory, { recursive: true });
  return targetDirectory;
}

export function buildFrameExportFilename(media: FramePreviewMedia, ratio: RatioType, format: FramePreviewFormat): string {
  return `${pathStem(media.filename)}_${ratio.replace(":", "-")}.${format}`;
}

export function buildBatchFolderName(media: FramePreviewMedia): string {
  return `${pathStem(media.filename)}_frame-preview`;
}
