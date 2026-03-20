import { toJpeg, toPng } from "html-to-image";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
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

function mediaDrawRect(
  canvasWidth: number,
  canvasHeight: number,
  mediaWidth: number,
  mediaHeight: number,
  transform: FrameTransform
) {
  const coverScale = Math.max(canvasWidth / mediaWidth, canvasHeight / mediaHeight);
  const finalWidth = mediaWidth * coverScale * transform.scale;
  const finalHeight = mediaHeight * coverScale * transform.scale;

  return {
    x: (canvasWidth - finalWidth) / 2 + transform.offsetX,
    y: (canvasHeight - finalHeight) / 2 + transform.offsetY,
    width: finalWidth,
    height: finalHeight
  };
}

async function loadImage(path: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = convertFileSrc(path);
  await image.decode();
  return image;
}

async function loadVideo(path: string, videoTimeSeconds = 0): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.src = convertFileSrc(path);

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

  return video;
}

export function getExportDimensions(ratio: RatioType, resolution: FramePreviewResolution) {
  const width = RESOLUTION_WIDTHS[resolution];
  const height = Math.round(width / RATIO_VALUES[ratio]);
  return { width, height };
}

export async function exportFrameToDataUrl(options: ExportFrameOptions): Promise<string> {
  const { media, ratio, transform, resolution, format, videoTimeSeconds } = options;
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

  const draw = mediaDrawRect(width, height, media.width, media.height, transform);
  context.drawImage(source, draw.x, draw.y, draw.width, draw.height);

  return format === "jpg"
    ? canvas.toDataURL("image/jpeg", 0.95)
    : canvas.toDataURL("image/png");
}

export async function exportFrameToPath(filePath: string, options: ExportFrameOptions): Promise<void> {
  const dataUrl = await exportFrameToDataUrl(options);
  await writeDataUrl(filePath, dataUrl);
}

export async function exportCanvasElement(filePath: string, options: ExportCanvasOptions): Promise<void> {
  const { element, width, height, format } = options;
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
