import React, { useState, useRef, useEffect, useCallback } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  Play, 
  Pause, 
  FileDown, 
  Maximize2, 
  ChevronDown, 
  X,
  Settings2,
  ShieldCheck,
  FolderOpen,
  LayoutGrid,
  Download,
  CopyCheck,
  PanelBottomClose,
  PanelBottomOpen
} from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useFramePreview } from './framePreviewLogic';
import { RatioType, FramePreviewMedia, RATIO_VALUES, INITIAL_TRANSFORM } from '../../types/framePreview';
import { ProductionProject } from '../../types';
import {
  buildFrameExportFilename,
  exportFrameToPath,
  FramePreviewFormat,
  FramePreviewResolution
} from './framePreviewExport';

interface FramePreviewAppProps {
  project?: ProductionProject | null;
  onBack: () => void;
}

interface PreviewFrameRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

interface FrameOffset {
  x: number;
  y: number;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

interface RenderedFrameRect extends PreviewFrameRect {
  ratio: RatioType;
  scale: number;
}

interface FrameResizeSession {
  x: number;
  y: number;
  ratio: RatioType;
  startScale: number;
  startWidth: number;
  startHeight: number;
  centerX: number;
  centerY: number;
  handle: Exclude<ResizeHandle, null>;
}

const BROWSER_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif']);
const RAW_IMAGE_EXTENSIONS = new Set(['dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'raf', 'rw2', 'orf', 'pef', 'srw', 'raw', 'rwl', 'iiq']);

function getFileExtension(path: string): string {
  const match = path.toLowerCase().match(/\.([^.\\/]+)$/);
  return match?.[1] ?? '';
}

function isImagePath(path: string): boolean {
  const extension = getFileExtension(path);
  return BROWSER_IMAGE_EXTENSIONS.has(extension) || RAW_IMAGE_EXTENSIONS.has(extension) || extension === 'tif' || extension === 'tiff' || extension === 'heic' || extension === 'heif';
}

function isBrowserReadableImagePath(path: string): boolean {
  return BROWSER_IMAGE_EXTENSIONS.has(getFileExtension(path));
}

function fitBox(ratio: number, maxWidth: number, maxHeight: number) {
  const safeWidth = Math.max(maxWidth, 1);
  const safeHeight = Math.max(maxHeight, 1);
  let width = safeWidth;
  let height = width / ratio;

  if (height > safeHeight) {
    height = safeHeight;
    width = height * ratio;
  }

  return { width, height };
}

function computePreviewLayout(ratios: number[], width: number, height: number): PreviewFrameRect[] {
  if (ratios.length === 0 || width <= 0 || height <= 0) {
    return [];
  }

  const gap = Math.min(24, Math.max(12, Math.min(width, height) * 0.025));

  if (ratios.length === 1) {
    const box = fitBox(ratios[0], width, height);
    return [{
      width: box.width,
      height: box.height,
      left: (width - box.width) / 2,
      top: (height - box.height) / 2
    }];
  }

  if (ratios.length === 2) {
    const rowHeight = Math.min(height, (width - gap) / (ratios[0] + ratios[1]));
    const firstWidth = ratios[0] * rowHeight;
    const secondWidth = ratios[1] * rowHeight;
    const totalWidth = firstWidth + gap + secondWidth;
    const leftOffset = (width - totalWidth) / 2;
    const topOffset = (height - rowHeight) / 2;

    return [
      { width: firstWidth, height: rowHeight, left: leftOffset, top: topOffset },
      { width: secondWidth, height: rowHeight, left: leftOffset + firstWidth + gap, top: topOffset }
    ];
  }

  const rightColumnWidth = (height - gap) / ((1 / ratios[1]) + (1 / ratios[2]));
  const secondHeight = rightColumnWidth / ratios[1];
  const thirdHeight = rightColumnWidth / ratios[2];
  const primaryMaxWidth = Math.max(width - gap - rightColumnWidth, width * 0.45);
  const primaryBox = fitBox(ratios[0], primaryMaxWidth, height);
  const totalWidth = primaryBox.width + gap + rightColumnWidth;
  const leftOffset = (width - totalWidth) / 2;
  const primaryTop = (height - primaryBox.height) / 2;
  const rightTop = (height - (secondHeight + gap + thirdHeight)) / 2;

  return [
    { width: primaryBox.width, height: primaryBox.height, left: leftOffset, top: primaryTop },
    { width: rightColumnWidth, height: secondHeight, left: leftOffset + primaryBox.width + gap, top: rightTop },
    { width: rightColumnWidth, height: thirdHeight, left: leftOffset + primaryBox.width + gap, top: rightTop + secondHeight + gap }
  ];
}

function resolveResizeHandle(clientX: number, clientY: number, rect: DOMRect): ResizeHandle {
  const edge = 10;
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const nearLeft = localX <= edge;
  const nearRight = rect.width - localX <= edge;
  const nearTop = localY <= edge;
  const nearBottom = rect.height - localY <= edge;

  if (nearTop && nearLeft) return 'nw';
  if (nearTop && nearRight) return 'ne';
  if (nearBottom && nearLeft) return 'sw';
  if (nearBottom && nearRight) return 'se';
  if (nearTop) return 'n';
  if (nearBottom) return 's';
  if (nearLeft) return 'w';
  if (nearRight) return 'e';
  return null;
}

function resizeCursor(handle: ResizeHandle): string | undefined {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    default:
      return undefined;
  }
}

export const FramePreviewApp: React.FC<FramePreviewAppProps> = ({ project, onBack }) => {
  void onBack;
  const {
    state,
    activeMedia,
    setMediaList,
    setActiveMedia,
    toggleMediaSelection,
    updateTransform,
    setVideoTime,
    clickRatio,
    toggleRatio,
    setMasterRatio,
    resetTransform
  } = useFramePreview();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isFrameDragging, setIsFrameDragging] = useState(false);
  const [isFrameResizing, setIsFrameResizing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [thumbnailsHidden, setThumbnailsHidden] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const dragStartRef = useRef<{ x: number; y: number; offX: number; offY: number; ratio: RatioType } | null>(null);
  const frameDragStartRef = useRef<{ x: number; y: number; startX: number; startY: number; ratio: RatioType } | null>(null);
  const frameResizeStartRef = useRef<FrameResizeSession | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const [frameOffsets, setFrameOffsets] = useState<Record<string, FrameOffset>>({});
  const [frameScales, setFrameScales] = useState<Record<string, number>>({});
  const [hoverResizeHandles, setHoverResizeHandles] = useState<Record<string, ResizeHandle>>({});
  const getAssetUrl = useCallback((path: string) => convertFileSrc(path), []);
  const getMediaPreviewUrl = useCallback((media: FramePreviewMedia) => getAssetUrl(media.preview_path ?? media.file_path), [getAssetUrl]);

  // Initialize with some media or empty state
  useEffect(() => {
    // Phase 1 can load from project folder or manually
  }, [project?.id]);

  const readImageMetadata = useCallback((path: string, sourcePath?: string) => {
    return new Promise<Pick<FramePreviewMedia, 'width' | 'height' | 'duration_ms' | 'thumbnail_src'>>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
        duration_ms: 0,
        thumbnail_src: getAssetUrl(sourcePath ?? path)
      });
      image.onerror = () => reject(new Error(`Failed to load image metadata for ${path}`));
      image.src = getAssetUrl(path);
    });
  }, [getAssetUrl]);

  const ensureStillPreviewPath = useCallback(async (path: string) => {
    if (isBrowserReadableImagePath(path)) {
      return undefined;
    }

    return invoke<string>('generate_frame_preview_image_proxy', { path });
  }, []);

  const readVideoMetadata = useCallback((path: string) => {
    return new Promise<Pick<FramePreviewMedia, 'width' | 'height' | 'duration_ms' | 'thumbnail_src'>>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = getAssetUrl(path);

      video.onloadedmetadata = () => {
        const seekTarget = Number.isFinite(video.duration) ? Math.min(video.duration * 0.1, Math.max(video.duration - 0.05, 0)) : 0;
        video.currentTime = seekTarget;
      };

      video.onseeked = () => {
        let thumbnail_src: string | undefined;

        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(video.videoWidth, 1);
          canvas.height = Math.max(video.videoHeight, 1);
          const context = canvas.getContext('2d');
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbnail_src = canvas.toDataURL('image/jpeg', 0.82);
          }
        } catch (_error) {
          thumbnail_src = undefined;
        }

        resolve({
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          duration_ms: Math.round((video.duration || 0) * 1000),
          thumbnail_src
        });
      };

      video.onerror = () => reject(new Error(`Failed to load video metadata for ${path}`));
    });
  }, [getAssetUrl]);

  const buildMediaEntry = useCallback(async (path: string): Promise<FramePreviewMedia> => {
    const filename = path.split(/[/\\]/).pop() || '';
    const isImage = isImagePath(path);
    const previewPath = isImage ? await ensureStillPreviewPath(path) : undefined;
    const renderPath = previewPath ?? path;
    const metadata = isImage ? await readImageMetadata(renderPath, renderPath) : await readVideoMetadata(path);

    return {
      id: crypto.randomUUID(),
      filename,
      file_path: path,
      preview_path: previewPath,
      width: metadata.width,
      height: metadata.height,
      duration_ms: metadata.duration_ms,
      status: 'ready',
      thumbnails: [],
      thumbnail_src: metadata.thumbnail_src,
      type: isImage ? 'image' : 'video'
    };
  }, [ensureStillPreviewPath, readImageMetadata, readVideoMetadata]);

  const handleAddMedia = async () => {
    const selected = await open({
      multiple: true,
      title: 'Select media for Frame Preview',
      filters: [{
        name: 'Media',
        extensions: ['mov', 'mp4', 'mxf', 'mkv', 'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'heic', 'heif', 'dng', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'raf', 'rw2', 'orf', 'pef', 'srw', 'raw', 'rwl', 'iiq']
      }]
    });

    if (!selected || !Array.isArray(selected)) return;

    const newMedia: FramePreviewMedia[] = await Promise.all(selected.map((path) => buildMediaEntry(path)));

    setMediaList([...state.mediaList, ...newMedia]);
  };

  const activeMediaState = activeMedia ? state.mediaStates[activeMedia.id] : undefined;
  const currentTransform = activeMediaState?.transforms[state.activeRatio] || INITIAL_TRANSFORM;
  const getTransform = useCallback((mediaId: string, ratio: RatioType) => {
    return state.mediaStates[mediaId]?.transforms[ratio] || INITIAL_TRANSFORM;
  }, [state.mediaStates]);
  const getSavedVideoTime = useCallback((mediaId: string) => {
    return state.mediaStates[mediaId]?.videoTimeSeconds ?? 0;
  }, [state.mediaStates]);
  const layoutRatios = state.masterRatio && state.visibleRatios.includes(state.masterRatio)
    ? [state.masterRatio, ...state.visibleRatios.filter((ratio) => ratio !== state.masterRatio)]
    : state.visibleRatios;
  const frameRects = computePreviewLayout(
    layoutRatios.map((ratio) => RATIO_VALUES[ratio]),
    canvasSize.width,
    canvasSize.height
  );
  const renderedFrameRectMap = layoutRatios.reduce<Record<string, RenderedFrameRect>>((acc, ratio, index) => {
    const rect = frameRects[index];
    const scale = frameScales[ratio] ?? 1;
    const offset = frameOffsets[ratio] || { x: 0, y: 0 };

    if (!rect) {
      acc[ratio] = {
        ratio,
        scale,
        width: 0,
        height: 0,
        left: 0,
        top: 0
      };
      return acc;
    }

    const scaledWidth = rect.width * scale;
    const scaledHeight = rect.height * scale;

    acc[ratio] = {
      ratio,
      scale,
      width: scaledWidth,
      height: scaledHeight,
      left: rect.left + offset.x - (scaledWidth - rect.width) / 2,
      top: rect.top + offset.y - (scaledHeight - rect.height) / 2
    };
    return acc;
  }, {});

  useEffect(() => {
    setFrameOffsets({});
    setFrameScales({});
    setHoverResizeHandles({});
  }, [state.visibleRatios.join('|')]);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
  }, [activeMedia?.id]);

  useEffect(() => {
    if (!exportMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [exportMenuOpen]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;

    const updateSize = () => {
      const nextWidth = Math.max(stage.clientWidth - 32, 0);
      const nextHeight = Math.max(stage.clientHeight - 32, 0);
      setCanvasSize({ width: nextWidth, height: nextHeight });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, ratio: RatioType) => {
    if (!activeMedia) return;
    const renderedRect = renderedFrameRectMap[ratio];
    const resizeHandle = hoverResizeHandles[ratio];
    if (renderedRect && resizeHandle) {
      setIsFrameDragging(false);
      setIsFrameResizing(true);
      frameResizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        ratio,
        startScale: renderedRect.scale,
        startWidth: renderedRect.width,
        startHeight: renderedRect.height,
        centerX: renderedRect.left + renderedRect.width / 2,
        centerY: renderedRect.top + renderedRect.height / 2,
        handle: resizeHandle
      };
      return;
    }
    if (e.metaKey || e.altKey) {
      const currentOffset = frameOffsets[ratio] || { x: 0, y: 0 };
      setIsFrameDragging(true);
      frameDragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startX: currentOffset.x,
        startY: currentOffset.y,
        ratio
      };
      return;
    }
    const transform = getTransform(activeMedia.id, ratio);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offX: transform.offsetX,
      offY: transform.offsetY,
      ratio
    };
  }, [activeMedia, frameOffsets, getTransform, hoverResizeHandles, renderedFrameRectMap]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !activeMedia) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    updateTransform(activeMedia.id, dragStartRef.current.ratio, {
      offsetX: dragStartRef.current.offX + dx,
      offsetY: dragStartRef.current.offY + dy
    });
  }, [activeMedia, isDragging, updateTransform]);

  const handleFrameMouseMove = useCallback((e: MouseEvent) => {
    if (!isFrameDragging || !frameDragStartRef.current) return;

    const currentRect = frameDragStartRef.current?.ratio ? renderedFrameRectMap[frameDragStartRef.current.ratio] : null;
    if (!currentRect) return;

    const dx = e.clientX - frameDragStartRef.current.x;
    const dy = e.clientY - frameDragStartRef.current.y;
    const unclampedX = frameDragStartRef.current.startX + dx;
    const unclampedY = frameDragStartRef.current.startY + dy;
    const minX = -currentRect.left;
    const maxX = canvasSize.width - currentRect.left - currentRect.width;
    const minY = -currentRect.top;
    const maxY = canvasSize.height - currentRect.top - currentRect.height;

    setFrameOffsets((prev) => ({
      ...prev,
      [frameDragStartRef.current!.ratio]: {
        x: Math.min(Math.max(unclampedX, minX), maxX),
        y: Math.min(Math.max(unclampedY, minY), maxY)
      }
    }));
  }, [canvasSize.height, canvasSize.width, isFrameDragging, renderedFrameRectMap]);

  const handleFrameResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!frameResizeStartRef.current) return;

    const session = frameResizeStartRef.current;
    const dx = e.clientX - session.x;
    const dy = e.clientY - session.y;
    const widthDelta = session.handle.includes('e') ? dx : (session.handle.includes('w') ? -dx : 0);
    const heightDelta = session.handle.includes('s') ? dy : (session.handle.includes('n') ? -dy : 0);

    const nextScaleFromWidth = widthDelta !== 0 ? (session.startWidth + widthDelta) / session.startWidth * session.startScale : null;
    const nextScaleFromHeight = heightDelta !== 0 ? (session.startHeight + heightDelta) / session.startHeight * session.startScale : null;
    const nextScale = Math.max(
      0.45,
      Math.min(
        nextScaleFromWidth && nextScaleFromHeight
          ? Math.max(nextScaleFromWidth, nextScaleFromHeight)
          : (nextScaleFromWidth ?? nextScaleFromHeight ?? session.startScale),
        Math.min(
          (2 * Math.min(session.centerX, canvasSize.width - session.centerX)) / Math.max(session.startWidth / session.startScale, 1),
          (2 * Math.min(session.centerY, canvasSize.height - session.centerY)) / Math.max(session.startHeight / session.startScale, 1),
          3
        )
      )
    );

    setFrameScales((prev) => ({
      ...prev,
      [session.ratio]: nextScale
    }));
  }, [canvasSize.height, canvasSize.width]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsFrameDragging(false);
    setIsFrameResizing(false);
    dragStartRef.current = null;
    frameDragStartRef.current = null;
    frameResizeStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging || isFrameDragging || isFrameResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mousemove', handleFrameMouseMove);
      window.addEventListener('mousemove', handleFrameResizeMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousemove', handleFrameMouseMove);
      window.removeEventListener('mousemove', handleFrameResizeMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousemove', handleFrameMouseMove);
      window.removeEventListener('mousemove', handleFrameResizeMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isFrameDragging, isFrameResizing, handleFrameMouseMove, handleFrameResizeMouseMove, handleMouseMove, handleMouseUp]);

  const handleWheel = useCallback((e: React.WheelEvent, ratio: RatioType) => {
    if (!activeMedia) return;
    e.preventDefault();
    const transform = getTransform(activeMedia.id, ratio);
    const delta = e.deltaY * -0.001;
    const nextScale = Math.min(Math.max(0.1, transform.scale + delta), 10);
    updateTransform(activeMedia.id, ratio, { scale: nextScale });
  }, [activeMedia, getTransform, updateTransform]);

  const activeVideoRef = state.activeRatio ? videoRefs.current[state.activeRatio] : null;

  useEffect(() => {
    const video = activeVideoRef;
    if (!video) {
      setProgress(0);
      return;
    }

    const updateProgress = () => {
      if (!video.duration) {
        setProgress(0);
        return;
      }
      setProgress((video.currentTime / video.duration) * 100);
      if (activeMedia) {
        setVideoTime(activeMedia.id, video.currentTime);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', updateProgress);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', updateProgress);
    };
  }, [activeMedia, activeVideoRef, setVideoTime, state.activeRatio]);

  useEffect(() => {
    if (!activeMedia || activeMedia.type !== 'video') return;

    const desiredTime = getSavedVideoTime(activeMedia.id);

    state.visibleRatios.forEach((ratio) => {
      const video = videoRefs.current[ratio];
      if (!video) return;

      const syncTime = () => {
        if (!video.duration) return;
        const safeTime = Math.min(Math.max(desiredTime, 0), Math.max(video.duration - 0.05, 0));
        if (Math.abs(video.currentTime - safeTime) > 0.05) {
          video.currentTime = safeTime;
        }
      };

      if (video.readyState >= 1) {
        syncTime();
      } else {
        video.addEventListener('loadedmetadata', syncTime, { once: true });
      }
    });
  }, [activeMedia, getSavedVideoTime, state.visibleRatios]);

  const toggleVideoPlayback = () => {
    const nextIsPlaying = !isPlaying;
    state.visibleRatios.forEach((ratio) => {
      const video = videoRefs.current[ratio];
      if (!video) return;
      if (nextIsPlaying) {
        void video.play();
      } else {
        video.pause();
      }
    });
    setIsPlaying(nextIsPlaying);
  };

  const handleVideoScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeMedia) return;
    const val = parseFloat(e.target.value);
    state.visibleRatios.forEach((ratio) => {
      const video = videoRefs.current[ratio];
      if (!video || !video.duration) return;
      video.currentTime = (val / 100) * video.duration;
    });
    if (activeVideoRef?.duration) {
      setVideoTime(activeMedia.id, (val / 100) * activeVideoRef.duration);
    }
    setProgress(val);
  };

  const [exportRes] = useState<FramePreviewResolution>('1080p');
  const [exportFormat] = useState<FramePreviewFormat>('jpg');
  const [safeGuides, setSafeGuides] = useState<Record<string, boolean>>({});

  const toggleSafeGuide = (ratio: RatioType) => {
    setSafeGuides(prev => ({ ...prev, [ratio]: !prev[ratio] }));
  };

  const copyTransform = (fromRatio: RatioType) => {
    if (!activeMedia) return;
    const transform = getTransform(activeMedia.id, fromRatio);
    if (!transform) return;
    
    state.visibleRatios.forEach(toRatio => {
        if (toRatio !== fromRatio) {
            updateTransform(activeMedia.id, toRatio, { ...transform });
        }
    });
  };

  const selectedExportRatios = state.selectedRatioIds.filter((ratio) => state.visibleRatios.includes(ratio));
  const activeVideoTimeSeconds = activeMedia ? getSavedVideoTime(activeMedia.id) : 0;

  const handleExportRatio = async (ratio: RatioType) => {
    if (!activeMedia) return;

    const filePath = await save({
      defaultPath: buildFrameExportFilename(activeMedia, ratio, exportFormat),
      filters: [{ name: 'Image', extensions: [exportFormat] }]
    });

    if (!filePath) return;

    setIsExporting(true);

    try {
      await exportFrameToPath(filePath, {
        media: activeMedia,
        ratio,
        transform: getTransform(activeMedia.id, ratio),
        resolution: exportRes,
        format: exportFormat,
        videoTimeSeconds: activeVideoTimeSeconds
      });
    } finally {
      setIsExporting(false);
      setExportMenuOpen(false);
    }
  };

  const handleExportSelectedFrames = async () => {
    if (!activeMedia || selectedExportRatios.length === 0) return;

    const selectedDirectory = await open({
      directory: true,
      multiple: false,
      title: 'Choose export folder for selected ratios'
    });

    if (!selectedDirectory || Array.isArray(selectedDirectory)) return;

    setIsExporting(true);

    try {
      for (const ratio of selectedExportRatios) {
        await exportFrameToPath(`${selectedDirectory}/${buildFrameExportFilename(activeMedia, ratio, exportFormat)}`, {
          media: activeMedia,
          ratio,
          transform: getTransform(activeMedia.id, ratio),
          resolution: exportRes,
          format: exportFormat,
          videoTimeSeconds: activeVideoTimeSeconds
        });
      }
    } finally {
      setIsExporting(false);
      setExportMenuOpen(false);
    }
  };

  const fitToFrame = useCallback((ratio: RatioType) => {
    if (!activeMedia) return;
    const renderedRect = renderedFrameRectMap[ratio];
    const frameWidth = Math.max((renderedRect?.width ?? 0) - 24, 1);
    const frameHeight = Math.max((renderedRect?.height ?? 0) - 54, 1);
    const containScale = Math.min(frameWidth / activeMedia.width, frameHeight / activeMedia.height);
    const coverScale = Math.max(frameWidth / activeMedia.width, frameHeight / activeMedia.height);
    const nextScale = containScale > 0 ? Math.max(1, coverScale / containScale) : 1;

    updateTransform(activeMedia.id, ratio, { scale: nextScale, offsetX: 0, offsetY: 0 });
  }, [activeMedia, renderedFrameRectMap, updateTransform]);

  const handleRatioChipClick = (ratio: RatioType, event: React.MouseEvent) => {
    const shouldAutoFitNewRatio = !event.shiftKey
      && !!activeMedia
      && !state.visibleRatios.includes(ratio)
      && !state.mediaStates[activeMedia.id]?.transforms[ratio];

    clickRatio(ratio, event.shiftKey);

    if (shouldAutoFitNewRatio) {
      fitToFrame(ratio);
    }
  };

  const activeSelectionLabel = selectedExportRatios.length > 1
    ? `${selectedExportRatios.length} selected`
    : selectedExportRatios[0] || state.activeRatio;

  return (
    <div className="frame-preview-app-container">
      {/* HEADER */}
      <header className="frame-preview-header premium-header">
        <div className="frame-preview-header-left">
        </div>

        <div className="frame-preview-header-center" />

        <div className="frame-preview-header-right">
            <div className="frame-preview-header-actions">
                <button className="btn btn-ghost btn-sm" title="Frame Preview Settings"><Settings2 size={16} /></button>
            </div>
        </div>
        {activeMedia && (
          <>
            <div className="frame-preview-control-section ratios">
                <span className="frame-preview-control-label">Ratios</span>
                <div className="frame-preview-ratio-chips-group">
                    {(['16:9', '9:16', '1:1', '4:5', '3:5', '4:3', '2.39:1'] as RatioType[]).map(r => {
                        const isVisible = state.visibleRatios.includes(r);
                        const isActive = state.activeRatio === r;
                        const isSelected = state.selectedRatioIds.includes(r);
                        return (
                            <button 
                                key={r}
                                type="button"
                                className={`frame-preview-ratio-chip ${isVisible ? 'visible' : ''} ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={(event) => handleRatioChipClick(r, event)}
                            >
                                {r}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="frame-preview-control-section playback">
                {activeMedia.type === 'video' && (
                    <div className="frame-preview-playback-controls">
                        <button className="btn-icon" onClick={toggleVideoPlayback}>
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <input 
                            type="range" 
                            className="frame-preview-scrubber" 
                            min="0" max="100" 
                            value={progress} 
                            onChange={handleVideoScrub} 
                        />
                    </div>
                )}
            </div>

	            <div className="frame-preview-control-section transforms">
                <div className="frame-preview-zoom-group">
                    <button className="btn btn-ghost btn-xs" onClick={() => activeMedia && updateTransform(activeMedia.id, state.activeRatio, { scale: Math.max(0.1, currentTransform.scale - 0.1) })}><Minus size={14} /></button>
                    <span className="frame-preview-zoom-value">{Math.round(currentTransform.scale * 100)}%</span>
                    <button className="btn btn-ghost btn-xs" onClick={() => activeMedia && updateTransform(activeMedia.id, state.activeRatio, { scale: Math.min(10, currentTransform.scale + 0.1) })}><Plus size={14} /></button>
                </div>
                
                <div className="frame-preview-btn-group">
                    <button className="btn btn-ghost btn-xs" onClick={() => fitToFrame(state.activeRatio)} title="Fit to Frame">
                        <Maximize2 size={14} /> <span>Fit</span>
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => activeMedia && resetTransform(activeMedia.id, state.activeRatio)}>
                        <RotateCcw size={14} /> <span>Reset</span>
                    </button>
                    <div className="frame-preview-export-menu" ref={exportMenuRef}>
                        <button
                            className="btn btn-primary btn-xs"
                            onClick={() => setExportMenuOpen((open) => !open)}
                            disabled={isExporting}
                            aria-expanded={exportMenuOpen}
                            aria-haspopup="menu"
                        >
                            <Download size={14} /> <span>Export</span> <ChevronDown size={14} />
                        </button>
                        {exportMenuOpen ? (
                            <div className="frame-preview-export-dropdown" role="menu">
                                <button
                                    className="frame-preview-export-item"
                                    onClick={() => void handleExportRatio(state.activeRatio)}
                                    disabled={isExporting}
                                >
                                    <Download size={14} /> <span>Export Frame</span>
                                </button>
                                <button
                                    className="frame-preview-export-item"
                                    onClick={() => void handleExportSelectedFrames()}
                                    disabled={selectedExportRatios.length === 0 || isExporting}
                                >
                                    <FileDown size={14} /> <span>Export Selected</span>
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="frame-preview-selection-pill">{activeSelectionLabel}</div>
            </div>
          </>
        )}
      </header>

      {/* MAIN VIEWPORT */}
      <main className="frame-preview-main-viewport">
        <div className="frame-preview-canvas-stage" ref={canvasStageRef}>
            {activeMedia && state.visibleRatios.length > 0 ? (
                <div className="frame-preview-canvas-surface">
                    {state.visibleRatios.map((ratio) => {
                        const transform = activeMedia ? getTransform(activeMedia.id, ratio) : INITIAL_TRANSFORM;
                        const isRatioActive = state.activeRatio === ratio;
                        const isRatioSelected = state.selectedRatioIds.includes(ratio);
                        const isMaster = state.masterRatio === ratio;
                        const rect = renderedFrameRectMap[ratio];

                        if (!rect) {
                          return null;
                        }

                        return (
                            <div 
                                key={ratio}
                                id={`frame-${ratio}`}
                                className={`frame-preview-ratio-frame ${isRatioActive ? 'active' : ''} ${isRatioSelected ? 'selected' : ''}`}
                                style={{
                                  width: rect.width,
                                  height: rect.height,
                                  left: rect.left,
                                  top: rect.top,
                                  cursor: resizeCursor(hoverResizeHandles[ratio]) ?? ((isFrameDragging && frameDragStartRef.current?.ratio === ratio) ? 'move' : undefined)
                                }}
                                onMouseMove={(e) => {
                                    const bounds = e.currentTarget.getBoundingClientRect();
                                    const nextHandle = resolveResizeHandle(e.clientX, e.clientY, bounds);
                                    setHoverResizeHandles((prev) => prev[ratio] === nextHandle ? prev : { ...prev, [ratio]: nextHandle });
                                }}
                                onMouseLeave={() => {
                                    if (!frameResizeStartRef.current) {
                                      setHoverResizeHandles((prev) => prev[ratio] ? { ...prev, [ratio]: null } : prev);
                                    }
                                }}
                                onMouseDown={(e) => {
                                    clickRatio(ratio, e.shiftKey);
                                    handleMouseDown(e, ratio);
                                }}
                                onWheel={(e) => {
                                    clickRatio(ratio, false);
                                    handleWheel(e, ratio);
                                }}
                            >
                                <div className="frame-preview-frame-header">
                                    <div className="frame-preview-frame-label">
                                      {ratio}
                                      {isMaster ? <span className="frame-preview-master-badge">M</span> : null}
                                      {isRatioSelected ? <CopyCheck size={12} /> : null}
                                    </div>
                                    <div className="frame-preview-frame-header-actions">
                                        <button
                                            className={`frame-preview-btn-frame-action ${isMaster ? 'active master' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); setMasterRatio(ratio); }}
                                            title={isMaster ? 'Unset Master Ratio' : 'Set Master Ratio'}
                                        >
                                            <span className="frame-preview-master-button-label">M</span>
                                        </button>
                                        <button 
                                            className={`frame-preview-btn-frame-action ${safeGuides[ratio] ? 'active' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); toggleSafeGuide(ratio); }}
                                            title="Toggle Safe Guides"
                                        >
                                            <ShieldCheck size={12} />
                                        </button>
                                        <button 
                                            className="frame-preview-btn-frame-action"
                                            onClick={(e) => { e.stopPropagation(); copyTransform(ratio); }}
                                            title="Apply framing to all ratios"
                                        >
                                            <LayoutGrid size={12} />
                                        </button>
                                        <button
                                            className="frame-preview-btn-frame-action"
                                            onClick={(e) => { e.stopPropagation(); toggleRatio(ratio); }}
                                            title="Remove Ratio"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="frame-preview-media-mount" style={{
                                    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
                                    transformOrigin: 'center'
                                }}>
                                    {activeMedia.type === 'video' ? (
                                        <video 
                                            key={`${activeMedia.id}-${ratio}`}
                                            ref={(node) => {
                                              videoRefs.current[ratio] = node;
                                            }}
                                            src={getAssetUrl(activeMedia.file_path)}
                                            muted
                                            loop
                                            playsInline
                                        />
                                    ) : (
                                        <img className="frame-preview-media-asset" src={getMediaPreviewUrl(activeMedia)} alt={activeMedia.filename} draggable={false} />
                                    )}
                                </div>

                                {safeGuides[ratio] && (
                                    <div className={`frame-preview-safe-guide-overlay ratio-${ratio.replace(':', '-')}`}>
                                        <div className="frame-preview-action-safe"></div>
                                        <div className="frame-preview-title-safe"></div>
                                        <div className="frame-preview-thirds-v-1"></div>
                                        <div className="frame-preview-thirds-v-2"></div>
                                        <div className="frame-preview-thirds-h-1"></div>
                                        <div className="frame-preview-thirds-h-2"></div>
                                        {(['9:16', '1:1', '4:5', '3:5'] as RatioType[]).includes(ratio) && (
                                            <>
                                                <div className="frame-preview-social-top-ui"></div>
                                                <div className="frame-preview-social-bottom-ui"></div>
                                                <div className="frame-preview-social-side-ui"></div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="frame-preview-empty-state">
                    <LayoutGrid size={48} className="muted" />
                    <h2>{activeMedia ? 'No ratios visible' : 'No media loaded'}</h2>
                    <p>{activeMedia ? 'Click a ratio chip to add a new preview frame.' : 'Load images or videos to begin reframing for delivery.'}</p>
                    {!activeMedia ? (
                      <button className="btn btn-secondary" onClick={handleAddMedia}>
                          <FolderOpen size={16} /> <span>Load Media</span>
                      </button>
                    ) : null}
                </div>
            )}
        </div>
      </main>

      {/* FOOTER: CONTROL BAR + FILMSTRIP */}
      <footer className={`frame-preview-app-footer ${thumbnailsHidden ? 'is-collapsed' : ''}`}>
          <button
              className="frame-preview-thumbs-toggle"
              onClick={() => setThumbnailsHidden((hidden) => !hidden)}
              title={thumbnailsHidden ? 'Show Thumbnails' : 'Hide Thumbnails'}
              aria-label={thumbnailsHidden ? 'Show Thumbnails' : 'Hide Thumbnails'}
          >
              {thumbnailsHidden ? <PanelBottomOpen size={14} /> : <PanelBottomClose size={14} />}
          </button>
          <div className="frame-preview-filmstrip-scroll">
              <div className="frame-preview-filmstrip-inner">
                <button className="frame-preview-filmstrip-card add-btn" onClick={handleAddMedia}>
                    <Plus size={20} />
                </button>

                {state.mediaList.map(media => {
                    const isActive = media.id === state.activeMediaId;
                    const isSelected = state.selectedMediaIds.has(media.id);
                    return (
                        <div 
                            key={media.id} 
                            className={`frame-preview-filmstrip-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => {
                                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                    toggleMediaSelection(media.id, true);
                                } else {
                                    setActiveMedia(media.id);
                                    toggleMediaSelection(media.id, false);
                                }
                            }}
                        >
                            <div className="frame-preview-card-thumb">
	                                {media.thumbnail_src ? (
	                                  <img
	                                    className="frame-preview-filmstrip-thumb"
	                                    src={media.thumbnail_src}
	                                    alt={media.filename}
	                                  />
	                                ) : null}
	                                {isSelected && <div className="frame-preview-selection-indicator"><ChevronDown size={14} /></div>}
	                            </div>
                            <div className="frame-preview-card-label">{media.filename}</div>
                        </div>
                    );
                })}
              </div>
          </div>
      </footer>
    </div>
  );
};
