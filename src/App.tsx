import { Component, ReactNode, useState, useEffect, useCallback } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  Camera,
  FolderOpen,
  FileText,
  FileDown,
  Info,
  ShieldCheck,
  ArrowRight,
  Clock,
  Star,
  Boxes,
  BriefcaseBusiness,
  MessageCircleWarning,
  BadgeInfo,
  CircleHelp,
  MoreHorizontal,
  LayoutGrid,
  Image as ImageIcon,
  Plus,
  Trash2,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import { ClipList } from "./components/ClipList";
import { PrintLayout } from "./components/PrintLayout";
import { SafeCopy } from "./components/SafeCopy";
import { ExportPanel } from "./components/ExportPanel";
import { BlocksView } from "./components/BlocksView";
import { JobsPanel } from "./components/JobsPanel";
import { AboutPanel } from "./components/AboutPanel";
import { TourGuide, TourStep } from "./components/TourGuide";
import { exportElementAsImage } from "./utils/ExportUtils";
import appLogo from "./assets/Icon_square_rounded.svg";
import { AppInfo, Clip, ClipWithThumbnails, JobInfo, ProjectRoot, ScanResult, ThumbnailProgress } from "./types";
import {
  LookbookSortMode,
  MOVEMENT_CANONICAL,
  SHOT_SIZE_CANONICAL,
  SHOT_SIZE_OPTIONAL,
  sortLookbookClips,
} from "./lookbook";

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: '#0f172a', color: 'white', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', maxWidth: 400, marginBottom: 24 }}>{this.state.error?.message || "An unexpected error occurred in the application UI."}</p>
          <button style={{ padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: 'white', fontWeight: 600, cursor: 'pointer' }} onClick={() => window.location.reload()}>Reload App</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const TOUR_VERSION = "1.0.0-beta.1";
  const TOUR_SEEN_KEY = "wp_has_seen_tour";
  const TOUR_VERSION_KEY = "wp_tour_version";
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [clips, setClips] = useState<ClipWithThumbnails[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0 });
  const [showPrint, setShowPrint] = useState(false);
  const [printingForImage, setPrintingForImage] = useState(false);
  const [preparingExport, setPreparingExport] = useState<{ kind: "pdf" | "image"; message: string } | null>(null);
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"home" | "shot-planner" | "media-workspace" | "contact" | "blocks" | "safe-copy">(() => {
    const saved = localStorage.getItem("wp_active_tab");
    if (saved === "home" || saved === "shot-planner" || saved === "media-workspace" || saved === "contact" || saved === "blocks" || saved === "safe-copy") {
      return saved;
    }
    return "home";
  });
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [projectRoots, setProjectRoots] = useState<ProjectRoot[]>([]);
  const [viewFilter, setViewFilter] = useState<"all" | "picks" | "rated_min">("all");
  const [viewMinRating, setViewMinRating] = useState<number>(3);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [lastVerificationJobId, setLastVerificationJobId] = useState<string | null>(null);
  const [uiError, setUiError] = useState<{ title: string; hint: string } | null>(null);
  const [tourRun, setTourRun] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [openExportAfterScan, setOpenExportAfterScan] = useState(false);
  const [lookbookSortMode, setLookbookSortMode] = useState<LookbookSortMode>(() => {
    const saved = localStorage.getItem("wp_lookbook_sort_mode");
    return saved === "canonical" ? "canonical" : "custom";
  });
  const [groupByShotSize, setGroupByShotSize] = useState<boolean>(() => {
    return localStorage.getItem("wp_group_shot_size") !== "false";
  });
  const [enableOptionalShotTags] = useState<boolean>(() => {
    return localStorage.getItem("wp_enable_optional_shot_tags") === "true";
  });
  const [sequenceMovementFilter] = useState<string>(() => {
    return localStorage.getItem("wp_sequence_movement_filter") || "all";
  });
  const [shotSizeFilter, setShotSizeFilter] = useState<string>(() => localStorage.getItem("wp_shot_size_filter") || "all");
  const [processingWaveforms, setProcessingWaveforms] = useState(false);

  // Settings with Persistence
  const [thumbCount, setThumbCount] = useState<number>(() => {
    const saved = localStorage.getItem("wp_thumbCount");
    return saved ? parseInt(saved, 10) : 5;
  });
  const [namingTemplate] = useState<string>(() => {
    return localStorage.getItem("wp_namingTemplate") || "ContactSheet_{PROJECT}_{DATE}";
  });

  useEffect(() => {
    localStorage.setItem("wp_thumbCount", thumbCount.toString());
    localStorage.setItem("wp_namingTemplate", namingTemplate);
  }, [thumbCount, namingTemplate]);

  useEffect(() => {
    localStorage.setItem("wp_lookbook_sort_mode", lookbookSortMode);
    localStorage.setItem("wp_group_shot_size", String(groupByShotSize));
    localStorage.setItem("wp_enable_optional_shot_tags", String(enableOptionalShotTags));
    localStorage.setItem("wp_sequence_movement_filter", sequenceMovementFilter);
    localStorage.setItem("wp_shot_size_filter", shotSizeFilter);
  }, [lookbookSortMode, groupByShotSize, enableOptionalShotTags, sequenceMovementFilter, shotSizeFilter]);

  useEffect(() => {
    localStorage.setItem("wp_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_SEEN_KEY) === "true";
    const version = localStorage.getItem(TOUR_VERSION_KEY);
    if (!seen || version !== TOUR_VERSION) {
      setTourRun(true);
    }
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      const data = await invoke<JobInfo[]>("list_jobs");
      setJobs(data);
    } catch (err) {
      console.error("Failed loading jobs", err);
    }
  }, []);

  useEffect(() => {
    refreshJobs();
    const t = setInterval(refreshJobs, 1000);
    return () => clearInterval(t);
  }, [refreshJobs]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<JobInfo>("job-progress", () => refreshJobs()).then((u) => { unlisten = u; }).catch(console.error);
    return () => {
      if (unlisten) unlisten();
    };
  }, [refreshJobs]);

  useEffect(() => {
    invoke<AppInfo>("get_app_info").then(setAppInfo).catch(console.error);
  }, []);

  // State for delayed actions
  const [postScanTab, setPostScanTab] = useState<"shot-planner" | "media-workspace" | "contact" | "blocks" | null>(null);

  const [hoveredClipId, setHoveredClipId] = useState<string | null>(null);

  const toggleClipSelection = useCallback((id: string) => {
    setSelectedClipIds((prev) => {
      const clip = clips.find((c) => c.clip.id === id)?.clip;
      if (!clip || clip.flag === "reject") return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [clips]);

  const handleUpdateMetadata = useCallback(async (clipId: string, updates: Partial<Pick<Clip, 'rating' | 'flag' | 'notes' | 'shot_size' | 'movement' | 'manual_order'>>) => {
    // Optimistic UI update
    setClips((prevClips) =>
      prevClips.map(clipItem => {
        if (clipItem.clip.id === clipId) {
          return {
            ...clipItem,
            clip: { ...clipItem.clip, ...updates }
          };
        }
        return clipItem;
      })
    );
    if (updates.flag === "reject") {
      setSelectedClipIds((prev) => {
        if (!prev.has(clipId)) return prev;
        const next = new Set(prev);
        next.delete(clipId);
        return next;
      });
    }

    try {
      await invoke("update_clip_metadata", {
        clipId,
        rating: updates.rating ?? null,
        flag: updates.flag ?? null,
        notes: updates.notes ?? null,
        shotSize: updates.shot_size ?? null,
        movement: updates.movement ?? null,
        manualOrder: updates.manual_order ?? null,
      });
    } catch (err) {
      console.error("Failed to persist metadata:", err);
      setUiError({ title: "Could not save rating/flag", hint: "Retry. If this persists, export diagnostics from header actions." });
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (tourRun) return;
      const inReview = activeTab === "contact" || activeTab === "shot-planner";
      if (!inReview) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.closest("[data-tour-tooltip]")) return;

      const targetId = hoveredClipId;
      const key = e.key.toLowerCase();

      if ((key === "arrowdown" || key === "arrowright" || key === "arrowup" || key === "arrowleft") && clips.length > 0) {
        e.preventDefault();
        const currentIndex = targetId ? clips.findIndex((c) => c.clip.id === targetId) : -1;
        const nextIndex = key === "arrowdown" || key === "arrowright"
          ? Math.min(currentIndex + 1, clips.length - 1)
          : Math.max(currentIndex - 1, 0);
        setHoveredClipId(clips[nextIndex].clip.id);
        return;
      }

      if (!targetId) return;

      if (key === "p") {
        e.preventDefault();
        handleExport();
        return;
      }
      if (key === "i") {
        e.preventDefault();
        handleExportImage();
        return;
      }

      if (key >= '0' && key <= '5') {
        handleUpdateMetadata(targetId, { rating: parseInt(key) });
      } else if (key === 'r' || key === 'x') {
        handleUpdateMetadata(targetId, { flag: 'reject' });
      } else if (key === 's') {
        toggleClipSelection(targetId);
      } else if (key === 'u' || key === ' ') {
        e.preventDefault();
        handleUpdateMetadata(targetId, { flag: 'none' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredClipId, clips, handleUpdateMetadata, tourRun, toggleClipSelection, activeTab]);

  // Automatic Audio Analysis Trigger
  useEffect(() => {
    const processClips = async () => {
      if (!projectId || processingWaveforms) return;
      const clipsToProcess = clips.filter(c => !c.clip.audio_envelope && c.clip.audio_codec !== "none");
      if (clipsToProcess.length === 0) return;

      setProcessingWaveforms(true);
      try {
        for (const item of clipsToProcess) {
          try {
            const envelope = await invoke<number[]>("extract_audio_waveform", { clipId: item.clip.id });
            setClips(prev => prev.map(c =>
              c.clip.id === item.clip.id ? { ...c, clip: { ...c.clip, audio_envelope: envelope } } : c
            ));
          } catch (err) {
            console.warn(`Failed to extract waveform for ${item.clip.id}:`, err);
          }
        }
      } finally {
        setProcessingWaveforms(false);
      }
    };

    if (clips.length > 0 && !scanning && !processingWaveforms) {
      processClips();
    }
  }, [projectId, clips.length, scanning, processingWaveforms]);

  useEffect(() => {
    if (projectId && postScanTab) {
      setActiveTab(postScanTab);
      setPostScanTab(null);
    }
  }, [projectId, postScanTab]);

  useEffect(() => {
    if (projectId && openExportAfterScan) {
      setShowExportPanel(true);
      setOpenExportAfterScan(false);
    }
  }, [projectId, openExportAfterScan]);

  useEffect(() => {
    setSelectedClipIds((prev) => {
      let changed = false;
      const allowed = new Set(
        clips
          .filter((row) => row.clip.flag !== "reject")
          .map((row) => row.clip.id)
      );
      const next = new Set<string>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [clips]);

  const hydrateThumbnailCache = useCallback(async (items: ClipWithThumbnails[]) => {
    const thumbEntries = items.flatMap((item) =>
      item.thumbnails.map((thumb) => ({
        key: `${thumb.clip_id}_${thumb.index}`,
        path: thumb.file_path
      }))
    );
    if (thumbEntries.length === 0) return;

    const results = thumbEntries.map(({ key, path }) => {
      try {
        const url = convertFileSrc(path);
        return { key, url };
      } catch (error) {
        console.warn(`Thumbnail load failed for ${path}`, error);
        return null;
      }
    });

    const nextCache: Record<string, string> = {};
    for (const item of results) {
      if (item) nextCache[item.key] = item.url;
    }
    if (Object.keys(nextCache).length > 0) {
      setThumbnailCache((prev) => ({ ...prev, ...nextCache }));
    }
  }, []);

  const refreshProjectClips = useCallback(async (nextProjectId: string) => {
    try {
      const clipRows = await invoke<ClipWithThumbnails[]>("get_clips", { projectId: nextProjectId });
      setClips(clipRows);
      await hydrateThumbnailCache(clipRows);
    } catch (error) {
      console.error("Failed to refresh clips:", error);
      setUiError({ title: "Could not load clip previews", hint: "Retry scan. If this persists, export diagnostics." });
    }
  }, [hydrateThumbnailCache]);

  const refreshProjectRoots = useCallback(async (nextProjectId: string) => {
    try {
      const roots = await invoke<ProjectRoot[]>("list_project_roots", { projectId: nextProjectId });
      setProjectRoots(roots);
    } catch (error) {
      console.error("Failed loading project roots", error);
    }
  }, []);

  // Listen for thumbnail progress events
  useEffect(() => {
    let unlistenProgress: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;

    async function setupListeners() {
      unlistenProgress = await listen<ThumbnailProgress>("thumbnail-progress", (event) => {
        const { clip_id, clip_index, total_clips, thumbnails } = event.payload;
        setExtractProgress({ done: clip_index + 1, total: total_clips });

        if (thumbnails.length > 0) {
          setClips((prev) =>
            prev.map((c) =>
              c.clip.id === clip_id ? { ...c, thumbnails: thumbnails } : c
            )
          );

          const results = thumbnails.map((thumb) => {
            try {
              const url = convertFileSrc(thumb.file_path);
              return { key: `${thumb.clip_id}_${thumb.index}`, url };
            } catch (e) {
              console.warn("Failed to load thumbnail:", e);
              return null;
            }
          });
          const newEntries: Record<string, string> = {};
          results.forEach(res => {
            if (res) newEntries[res.key] = res.url;
          });
          if (Object.keys(newEntries).length > 0) {
            setThumbnailCache(prev => ({ ...prev, ...newEntries }));
          }
        }
      });

      unlistenComplete = await listen("thumbnail-complete", async () => {
        setExtracting(false);
        if (projectId) {
          await refreshProjectClips(projectId);
        }
      });
    }

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, [projectId, refreshProjectClips]);

  const handleSelectFolder = useCallback(async (targetTab?: "shot-planner" | "media-workspace" | "contact" | "blocks") => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Footage Folder",
    });

    if (!selected) return;

    setScanning(true);
    setClips([]);
    setThumbnailCache({});
    setProjectId(null);
    setSelectedBlockIds([]);
    if (targetTab) setPostScanTab(targetTab);

    try {
      const result = await invoke<ScanResult>("scan_folder", {
        folderPath: selected,
      });

      setProjectId(result.project_id);
      setProjectName(result.project_name);
      setClips(result.clips.map((clip) => ({ clip, thumbnails: [] })));

      setExtracting(true);
      setExtractProgress({ done: 0, total: result.clip_count });
      invoke("extract_thumbnails", { projectId: result.project_id }).catch(
        (e) => {
          console.error("Thumbnail extraction error:", e);
          setUiError({ title: "Thumbnail extraction failed", hint: "Retry scan or check media read permissions." });
          setExtracting(false);
        }
      );

      refreshProjectClips(result.project_id).catch((err) => {
        console.warn("Initial clip refresh failed", err);
      });
      refreshProjectRoots(result.project_id).catch((err) => {
        console.warn("Initial roots refresh failed", err);
      });
    } catch (e) {
      console.error("Scan error:", e);
      setUiError({ title: "Scan failed", hint: "Verify folder access and media formats, then retry." });
    } finally {
      setScanning(false);
    }
  }, [refreshProjectClips, refreshProjectRoots]);

  useEffect(() => {
    if (!projectId) {
      setProjectRoots([]);
      return;
    }
    refreshProjectRoots(projectId).catch(console.error);
  }, [projectId, refreshProjectRoots]);

  const handleGoHome = useCallback(() => {
    setProjectId(null);
    setClips([]);
    setSelectedClipIds(new Set());
    setExtracting(false);
    setActiveTab("home");
  }, []);

  const handleBack = useCallback(() => {
    if (activeTab === "contact" || activeTab === "blocks" || activeTab === "safe-copy") {
      setActiveTab("media-workspace");
      return;
    }
    if (activeTab === "media-workspace" || activeTab === "shot-planner") {
      setActiveTab("home");
      return;
    }
    setActiveTab("home");
  }, [activeTab]);

  const tourSteps: TourStep[] = [
    {
      target: ".onboarding-grid",
      title: "Workflow Modules",
      description: "Start from these cards to run the suite in order.",
      placement: "bottom",
      learnMore: ["Each module focuses on one production phase.", "You can jump modules at any time.", "Use Jobs to monitor long tasks."]
    },
    {
      target: ".tour-safe-copy-module",
      title: "Safe Copy",
      description: "Run FAST or SOLID verification before editorial work.",
      placement: "right",
      learnMore: ["SOLID uses full-file hashing.", "FAST checks metadata quickly.", "Export JSON reports for records."]
    },
    {
      target: ".tour-contact-module",
      title: "Contact Sheet",
      description: "Scan media and generate visual strip previews.",
      placement: "right"
    },
    {
      target: ".clip-rating",
      title: "Ratings & Flags",
      description: "Use stars and pick/reject to tag editorial selects.",
      placement: "top"
    },
    {
      target: ".waveform-container",
      title: "Audio Waveform",
      description: "Waveform and badges help identify low/absent/clipped audio quickly.",
      placement: "top"
    },
    {
      target: ".tour-blocks-tab",
      title: "Blocks",
      description: "Open Blocks to cluster clips by timeline gaps and camera labels.",
      placement: "bottom"
    },
    {
      target: ".tour-open-export",
      title: "Resolve Export",
      description: "Open export to generate structured FCPXML for Resolve.",
      placement: "bottom"
    },
    {
      target: ".tour-director-pack-btn",
      title: "Director Pack",
      description: "Create a deterministic bundle with PDF, FCPXML, and JSON report.",
      placement: "left"
    }
  ];

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
    localStorage.setItem(TOUR_VERSION_KEY, TOUR_VERSION);
    setTourRun(false);
  }, []);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_SEEN_KEY);
    localStorage.removeItem(TOUR_VERSION_KEY);
    setTourRun(false);
  }, []);


  const getExportFilename = () => {
    const date = new Date().toISOString().split('T')[0];
    return namingTemplate
      .replace("{PROJECT}", projectName || "ContactSheet")
      .replace("{DATE}", date)
      .replace("{COUNT}", selectedClipIds.size.toString());
  };

  const waitForPrintAssets = useCallback(async () => {
    const waitForMount = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await waitForMount(120);
    const printArea = document.getElementById("print-area");
    if (!printArea) {
      throw new Error("Print layout not ready.");
    }

    const clipRows = Array.from(printArea.querySelectorAll(".print-clip-row"));
    if (clipRows.length === 0) {
      throw new Error("No clip rows are available for export.");
    }

    const thumbImages = Array.from(printArea.querySelectorAll(".print-thumb img")) as HTMLImageElement[];
    const waitForImage = (img: HTMLImageElement) =>
      new Promise<void>((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });

    await Promise.all(thumbImages.map(waitForImage));
    const loadedThumbs = thumbImages.filter((img) => img.naturalWidth > 0).length;
    if (loadedThumbs === 0) {
      throw new Error("No thumbnails were available for export.");
    }
  }, []);

  const handleExportImage = async () => {
    if (selectedClipIds.size === 0) return;
    setPrintingForImage(true);
    setPreparingExport({ kind: "image", message: "Preparing image export..." });
    try {
      await waitForPrintAssets();
      const element = document.getElementById("print-area");
      if (!element) {
        throw new Error("Export layout unavailable.");
      }
      await exportElementAsImage(element, getExportFilename());
      setUiError(null);
    } catch (err) {
      console.error(err);
      setUiError({
        title: "Image export failed",
        hint: "Retry after thumbnails load. If it persists, export diagnostics and check folder permissions.",
      });
    } finally {
      setPreparingExport(null);
      setPrintingForImage(false);
    }
  };

  const handlePromoteClip = async (clipId: string) => {
    try {
      await invoke("promote_clip_to_block", { projectId, clipId });
      if (projectId) {
        await refreshProjectClips(projectId);
      }
    } catch (error) {
      console.error("Failed to promote clip:", error);
      setUiError({ title: "Promotion Failed", hint: String(error) });
    }
  };

  const handlePlayClip = async (clipId: string) => {
    const clip = clips.find(c => c.clip.id === clipId);
    if (clip) {
      try {
        await openPath(clip.clip.file_path);
      } catch (error) {
        console.error("Failed to play clip:", error);
        setUiError({ title: "Playback Failed", hint: String(error) });
      }
    }
  };

  const handleExport = useCallback(() => {
    if (selectedClipIds.size === 0) {
      alert("Please select at least one clip to export.");
      return;
    }
    const run = async () => {
      setShowPrint(true);
      setPreparingExport({ kind: "pdf", message: "Preparing PDF export..." });
      try {
        await waitForPrintAssets();
        window.print();
        setUiError(null);
      } catch (err) {
        console.error(err);
        setUiError({
          title: "PDF export blocked",
          hint: "No thumbnails/data were ready for export. Re-run check clips and try again.",
        });
      } finally {
        setPreparingExport(null);
        setTimeout(() => setShowPrint(false), 350);
      }
    };
    run().catch((err) => {
      console.error(err);
      setPreparingExport(null);
      setShowPrint(false);
    });
  }, [selectedClipIds, waitForPrintAssets]);

  const totalClips = clips.length;
  const okClips = clips.filter((c) => c.clip.status === "ok").length;
  const warnClips = clips.filter((c) => c.clip.status === "warn").length;
  const runningJobs = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const failedJobs = jobs.filter((j) => j.status === "failed").length;
  const totalSize = clips.reduce((acc, c) => acc + c.clip.size_bytes, 0);
  const totalDuration = clips.reduce((acc, c) => acc + c.clip.duration_ms, 0);

  const visibleClips = clips.filter(({ clip }) => {
    const viewMatch =
      viewFilter === "picks" ? clip.flag === "pick" :
        viewFilter === "rated_min" ? clip.rating >= viewMinRating :
          true;
    const shotSizeMatch = shotSizeFilter === "all" ? true : clip.shot_size === shotSizeFilter;
    return viewMatch && shotSizeMatch;
  });
  const lookbookSorted = sortLookbookClips(visibleClips, lookbookSortMode);
  const sortedClips = lookbookSorted;
  const selectableClipIds = sortedClips
    .filter((c) => c.clip.flag !== "reject")
    .map((c) => c.clip.id);
  const selectedSelectableCount = selectableClipIds.filter((id) => selectedClipIds.has(id)).length;

  const toggleSelectAll = () => {
    if (selectedSelectableCount === selectableClipIds.length) {
      setSelectedClipIds(new Set());
      return;
    }
    setSelectedClipIds(new Set(selectableClipIds));
  };

  const thumbnailsByClipId = clips.reduce<Record<string, ClipWithThumbnails["thumbnails"]>>((acc, row) => {
    acc[row.clip.id] = row.thumbnails;
    return acc;
  }, {});

  return (
    <div className="app-shell">
      {(showPrint || printingForImage) && (
        <div id="print-area" style={printingForImage ? { position: 'absolute', left: '-9999px', width: '297mm' } : {}}>
          <PrintLayout
            projectName={projectName}
            clips={sortedClips.filter(c => selectedClipIds.has(c.clip.id) && c.clip.flag !== "reject")}
            thumbnailCache={thumbnailCache}
            brandProfile={null}
            logoSrc={appLogo}
            appVersion={appInfo?.version || "unknown"}
            thumbCount={thumbCount}
            onClose={() => {
              if (!printingForImage) setShowPrint(false);
            }}
          />
        </div>
      )}
      {preparingExport && (
        <div className="export-preparing-overlay" role="status" aria-live="polite">
          <div className="export-preparing-card">
            <div className="spinner" />
            <strong>{preparingExport.kind === "pdf" ? "Preparing PDF" : "Preparing Image"}</strong>
            <span>{preparingExport.message}</span>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo" onClick={handleGoHome} style={{ cursor: 'pointer' }}>
            <div className="app-logo-icon">
              <img src={appLogo} alt="Wrap Preview Logo" />
            </div>
            <span>Wrap Preview</span>
          </div>
          {activeTab !== "home" && (
            <nav className="app-tabs-nav">
              <button className="nav-tab" onClick={handleBack} title="Back">
                <ChevronLeft size={15} /> Back
              </button>
              <button className="nav-tab" onClick={() => setActiveTab('home')}>
                <LayoutGrid size={15} /> Modules
              </button>
              <button className={`nav-tab ${activeTab === 'safe-copy' ? 'active' : ''}`} onClick={() => setActiveTab('safe-copy')} title="Safe Copy (Verification)">
                <ShieldCheck size={15} /> Safe Copy
              </button>
              <button className={`nav-tab ${activeTab === 'contact' || activeTab === 'shot-planner' ? 'active' : ''}`} onClick={() => setActiveTab(activeTab === "shot-planner" ? 'shot-planner' : 'contact')}>
                <Camera size={15} /> Review
              </button>
              <button className={`nav-tab tour-blocks-tab ${activeTab === 'blocks' ? 'active' : ''}`} onClick={() => setActiveTab('blocks')} disabled={!projectId}>
                <Boxes size={15} /> Scene Blocks
              </button>
              <button className={`nav-tab ${showExportPanel ? 'active' : ''}`} onClick={() => setShowExportPanel(true)} disabled={!projectId}>
                <FileDown size={15} /> Delivery
              </button>
            </nav>
          )}
          {(activeTab === 'contact' || activeTab === 'blocks') && projectName && (
            <span className="header-project-name">/ {projectName}</span>
          )}
        </div>
        <div className="app-header-right">
          {(activeTab === 'shot-planner' || activeTab === 'media-workspace' || activeTab === 'contact' || activeTab === 'blocks') && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => handleSelectFolder(
                  activeTab === "blocks"
                    ? "blocks"
                    : activeTab === "shot-planner"
                      ? "shot-planner"
                      : activeTab === "media-workspace"
                        ? "media-workspace"
                        : "contact"
                )}
                disabled={scanning}
                title="Check clips and generate metadata/thumbnails for a media folder."
              >
                {scanning ? <div className="spinner" /> : <FolderOpen size={16} />}
                {scanning ? "Scanning..." : "Check Clips"}
              </button>
              {projectId && (
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      await invoke("auto_analyze_lookbook", { projectId, recompute: false });
                      await refreshProjectClips(projectId);
                    } catch (e) {
                      console.error(e);
                      setUiError({ title: "Auto Analyze failed", hint: "Retry analysis or export diagnostics if it persists." });
                    }
                  }}
                >
                  <Star size={16} /> Auto Analyze
                </button>
              )}
              <div className="help-menu-wrapper">
                <button className="btn btn-icon" onClick={() => setHelpMenuOpen(!helpMenuOpen)} title="Help & Info">
                  <MoreHorizontal size={18} />
                </button>
                {helpMenuOpen && (
                  <>
                    <div className="dropdown-backdrop" onClick={() => setHelpMenuOpen(false)} />
                    <div className="help-dropdown">
                      <button className="dropdown-item" onClick={() => { setAboutOpen(true); setHelpMenuOpen(false); }}>
                        <BadgeInfo size={15} /> About Wrap Preview
                      </button>
                      <button className="dropdown-item" onClick={async () => {
                        setHelpMenuOpen(false);
                        const dest = await open({ directory: true, multiple: false, title: "Export Feedback Bundle" });
                        if (!dest) return;
                        try {
                          const zip = await invoke<string>("export_feedback_bundle", { outputRoot: dest, lastVerificationJobId });
                          try { await openPath(zip); } catch (openErr) {
                            console.warn("openPath failed for feedback bundle", openErr);
                            setUiError({ title: "Feedback bundle exported", hint: `Saved at ${zip}. Use Finder to open if auto-open is blocked.` });
                          }
                        } catch (e) {
                          console.error(e);
                          setUiError({ title: "Diagnostics export failed", hint: "Retry and verify destination folder is writable." });
                        }
                      }}>
                        <MessageCircleWarning size={15} /> Send Feedback
                      </button>
                      <div className="dropdown-divider" />
                      <button className="dropdown-item" onClick={() => {
                        setHelpMenuOpen(false);
                        if (tourRun) completeTour();
                        else setTourRun(true);
                      }}>
                        <CircleHelp size={15} /> {tourRun ? "Hide Tour" : "Show Tour"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => setJobsOpen(true)}>
            <BriefcaseBusiness size={16} /> Jobs {runningJobs > 0 ? `(${runningJobs})` : ""}
            <span className={`clip-status-dot ${failedJobs > 0 ? "fail" : runningJobs > 0 ? "warn" : "ok"}`} />
          </button>
        </div>
      </header>

      <div className="app-content">
        {uiError && (
          <div className="error-banner">
            <strong>{uiError.title}</strong> {uiError.hint}
          </div>
        )}
        {activeTab === 'safe-copy' ? (
          <SafeCopy projectId={projectId ?? "__global__"} onJobCreated={setLastVerificationJobId} onError={setUiError} />
        ) : activeTab === 'media-workspace' ? (
          <div className="onboarding-container">
            <div className="onboarding-header">
              <h1>Media Workspace</h1>
              <p>Verify, review, organize, export.</p>
            </div>
            {projectId && (
              <div className="workspace-roots-panel">
                <div className="workspace-roots-header">
                  <span className="toolbar-label">Project Roots</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        const selected = await open({ directory: true, multiple: false, title: "Add Project Root" });
                        if (!selected || typeof selected !== "string") return;
                        await invoke("add_project_root", { projectId, rootPath: selected, label: `Root ${String(projectRoots.length + 1).padStart(2, "0")}` });
                        await refreshProjectRoots(projectId);
                      }}
                    >
                      <Plus size={14} /> Add Root
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={async () => {
                        await invoke("rescan_project", { projectId });
                        await refreshProjectClips(projectId);
                      }}
                    >
                      <RefreshCw size={14} /> Rescan
                    </button>
                  </div>
                </div>
                <div className="workspace-roots-list">
                  {projectRoots.map((root) => (
                    <div key={root.id} className="workspace-root-item">
                      <input
                        className="input-text"
                        defaultValue={root.label}
                        onBlur={async (e) => {
                          const nextLabel = e.currentTarget.value.trim();
                          if (!nextLabel || nextLabel === root.label) return;
                          await invoke("update_project_root_label", { rootId: root.id, label: nextLabel });
                          await refreshProjectRoots(projectId);
                        }}
                      />
                      <span className="workspace-root-path">{root.root_path}</span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          await invoke("remove_project_root", { rootId: root.id });
                          await refreshProjectRoots(projectId);
                          await invoke("rescan_project", { projectId });
                          await refreshProjectClips(projectId);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="onboarding-grid workspace-apps-grid">
              <div
                className="module-card"
                onClick={() => setActiveTab("safe-copy")}
              >
                <div className="module-icon"><ShieldCheck size={32} strokeWidth={1.5} /></div>
                <div className="module-info">
                  <h3>Safe Copy (Verification)</h3>
                  <p>Validate copied media integrity.</p>
                  <span className="module-action">Verify <ArrowRight size={14} /></span>
                </div>
              </div>
              <div
                className={`module-card ${!projectId ? "disabled" : ""}`}
                onClick={() => {
                  if (projectId) setActiveTab("contact");
                }}
              >
                <div className="module-icon"><Camera size={32} strokeWidth={1.5} /></div>
                <div className="module-info">
                  <h3>Review</h3>
                  <p>Review clips and metadata.</p>
                  <span className="module-action">{projectId ? <>Open <ArrowRight size={14} /></> : "Load workspace first"}</span>
                </div>
              </div>
              <div
                className={`module-card ${!projectId ? "disabled" : ""}`}
                onClick={() => {
                  if (projectId) setActiveTab("blocks");
                }}
              >
                <div className="module-icon"><Boxes size={32} strokeWidth={1.5} /></div>
                <div className="module-info">
                  <h3>Scene Blocks</h3>
                  <p>Group clips into editorial moments.</p>
                  <span className="module-action">{projectId ? <>Open <ArrowRight size={14} /></> : "Load workspace first"}</span>
                </div>
              </div>
              <div
                className={`module-card ${!projectId ? "disabled" : ""}`}
                onClick={() => {
                  if (projectId) {
                    setShowExportPanel(true);
                  }
                }}
              >
                <div className="module-icon"><FileDown size={32} strokeWidth={1.5} /></div>
                <div className="module-info">
                  <h3>Delivery</h3>
                  <p>Prepare edit handoff and delivery package.</p>
                  <span className="module-action">{projectId ? <>Open <ArrowRight size={14} /></> : "Load workspace first"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'home' ? (
          <div className="onboarding-container">
            <div className="onboarding-header">
              <h1>Wrap Preview Suite</h1>
            </div>
            <div className="onboarding-phases-wrapper">
              <div className="onboarding-phase">
                <div className="onboarding-grid">
                  <div
                    className={`module-card tour-contact-module ${scanning ? 'disabled' : ''}`}
                    onClick={scanning ? undefined : () => setActiveTab("shot-planner")}
                  >
                    <div className="module-icon">
                      {scanning ? <div className="spinner" /> : <ImageIcon size={32} strokeWidth={1.5} />}
                    </div>
                    <div className="module-info">
                      <h3>Shot Planner</h3>
                      <p>References, sequencing, vertical plans.</p>
                      <span className="module-action">
                        Open <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="onboarding-phase">
                <div className="onboarding-grid">
                  <div
                    className={`module-card tour-safe-copy-module ${scanning ? 'disabled' : ''}`}
                    onClick={scanning ? undefined : () => setActiveTab("media-workspace")}
                  >
                    <div className="module-icon">
                      {scanning ? <div className="spinner" /> : <BriefcaseBusiness size={32} strokeWidth={1.5} />}
                    </div>
                    <div className="module-info">
                      <h3>Media Workspace</h3>
                      <p>Verify, review, organize, export.</p>
                      <span className="module-action">
                        Open <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "blocks" ? (
          projectId ? (
            <BlocksView
              projectId={projectId}
              thumbnailCache={thumbnailCache}
              thumbnailsByClipId={thumbnailsByClipId}
              onSelectedBlockIdsChange={setSelectedBlockIds}
              onRequestGenerateThumbnails={async () => {
                try {
                  setExtracting(true);
                  setExtractProgress({ done: 0, total: clips.length });
                  await invoke("extract_thumbnails", { projectId });
                } catch (error) {
                  console.error("Thumbnail extraction error:", error);
                  setUiError({ title: "Thumbnail extraction failed", hint: "Retry and confirm media folder is readable." });
                  setExtracting(false);
                }
              }}
            />
          ) : (
            <div className="onboarding-container">
              <div className="empty-state">No project loaded. Use <strong>Check Clips</strong> to scan a media folder first.</div>
            </div>
          )
        ) : (
          <>
            <div className="stats-bar">
              <div className={`stat-card ${selectedClipIds.size > 0 ? 'stat-card-highlight' : ''}`}>
                <div className="stat-header">
                  <span className="stat-label">Selection</span>
                </div>
                <span className="stat-value stat-value-xl">{selectedClipIds.size}<span className="stat-value-total"> / {totalClips}</span></span>
                <span className="stat-sub">Selected for Export</span>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Assets</span>
                  <Info size={12} className="info-icon" data-tooltip="Total video files discovered." />
                </div>
                <span className="stat-value">{totalClips}</span>
                <div className="stat-sub-group">
                  <span className="stat-sub-item ok">{okClips} OK</span>
                  <span className="stat-sub-item warn">{warnClips} WARN</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Warnings</span>
                  <Info size={12} className="info-icon" data-tooltip="No embedded timecode found in these files." />
                </div>
                <span className="stat-value">{warnClips}</span>
                <span className="stat-sub">Missing Timecode</span>
              </div>
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">Total Duration</span>
                  <Clock size={12} className="info-icon" data-tooltip="Cumulative runtime of all discovered clips." />
                </div>
                <span className="stat-value">{formatDuration(totalDuration)}</span>
                <span className="stat-sub">{formatFileSize(totalSize)} total volume</span>
              </div>
            </div>

            {extracting && (
              <div className="progress-container">
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-fill" style={{ width: `${extractProgress.total > 0 ? (extractProgress.done / extractProgress.total) * 100 : 0}% ` }} />
                </div>
                <div className="progress-label">
                  <span>Extracting thumbnails…</span>
                  <span>{extractProgress.done} / {extractProgress.total}</span>
                </div>
              </div>
            )}

            <div className="toolbar premium-toolbar">
              <div className="toolbar-left-group">
                <div className="toolbar-segment">
                  <span className="toolbar-label">Sort</span>
                  <div className="sort-group">
                    <select className="input-select" value={lookbookSortMode} onChange={(e) => setLookbookSortMode(e.target.value as LookbookSortMode)}>
                      <option value="custom">Custom Manual</option>
                      <option value="canonical">Canonical</option>
                    </select>
                  </div>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-segment">
                  <span className="toolbar-label">Filter</span>
                  <div className="sort-group">
                    <select className="input-select" value={viewFilter} onChange={(e) => setViewFilter(e.target.value as "all" | "picks" | "rated_min")}>
                      <option value="all">Show All</option>
                      <option value="picks">Picks Only</option>
                      <option value="rated_min">Rating &gt;= N</option>
                    </select>
                    {viewFilter === "rated_min" && (
                      <select className="input-select" value={viewMinRating} onChange={(e) => setViewMinRating(Number(e.target.value))}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}+</option>
                        ))}
                      </select>
                    )}
                    <select className="input-select" value={shotSizeFilter} onChange={(e) => setShotSizeFilter(e.target.value)}>
                      <option value="all">All Shot Sizes</option>
                      {[...SHOT_SIZE_CANONICAL, ...(enableOptionalShotTags ? SHOT_SIZE_OPTIONAL : [])].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-segment">
                  <span className="toolbar-label">Layout</span>
                  <div className="segmented-control">
                    {[3, 5, 7].map((n) => (
                      <button key={n} className={`btn-toggle ${thumbCount === n ? 'active' : ''}`} onClick={() => setThumbCount(n)}>{n}</button>
                    ))}
                  </div>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-segment">
                  <span className="toolbar-label">View</span>
                  <div className="segmented-control">
                    <button className={`btn-toggle ${!groupByShotSize ? 'active' : ''}`} onClick={() => setGroupByShotSize(false)}>List</button>
                    <button className={`btn-toggle ${groupByShotSize ? 'active' : ''}`} onClick={() => setGroupByShotSize(true)}>Group</button>
                  </div>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-segment">
                  <span className="toolbar-label">Selection</span>
                  <div className="toolbar-actions">
                    <button className="btn-link" onClick={toggleSelectAll}>{selectableClipIds.length > 0 && selectedSelectableCount === selectableClipIds.length ? "Clear" : "All"}</button>
                  </div>
                </div>
              </div>

              <div className="toolbar-right-group">
                {projectId && clips.length > 0 && !extracting && (
                  <div className="export-dropdown-wrapper">
                    <button
                      className="btn btn-primary btn-export tour-open-export"
                      onClick={() => setExportMenuOpen(!exportMenuOpen)}
                      disabled={selectedClipIds.size === 0}
                    >
                      <FileDown size={16} /> Export ▾
                    </button>
                    {exportMenuOpen && (
                      <>
                        <div className="dropdown-backdrop" onClick={() => setExportMenuOpen(false)} />
                        <div className="export-dropdown">
                          <button className="dropdown-item" onClick={() => { handleExport(); setExportMenuOpen(false); }}>
                            <FileText size={15} /> Export as PDF
                          </button>
                          <button className="dropdown-item" onClick={() => { handleExportImage(); setExportMenuOpen(false); }}>
                            <ImageIcon size={15} /> Export as Image
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <ClipList
              clips={sortedClips}
              thumbnailCache={thumbnailCache}
              isExtracting={extracting}
              selectedIds={selectedClipIds}
              onToggleSelection={toggleClipSelection}
              thumbCount={thumbCount}
              onUpdateMetadata={handleUpdateMetadata}
              onHoverClip={setHoveredClipId}
              shotSizeOptions={[...SHOT_SIZE_CANONICAL, ...(enableOptionalShotTags ? SHOT_SIZE_OPTIONAL : [])]}
              movementOptions={[...MOVEMENT_CANONICAL]}
              lookbookSortMode={lookbookSortMode}
              groupByShotSize={groupByShotSize}
              onPromoteClip={handlePromoteClip}
              onPlayClip={handlePlayClip}
              focusedClipId={hoveredClipId}
            />
          </>
        )}
      </div>

      {
        showExportPanel && projectId && (
          <ExportPanel
            projectId={projectId}
            clips={clips.map(c => c.clip).filter((c) => c.flag !== "reject")}
            selectedBlockIds={selectedBlockIds}
            currentFilterMode={viewFilter}
            currentFilterMinRating={viewMinRating}
            onError={setUiError}
            onClose={() => setShowExportPanel(false)}
          />
        )
      }
      <JobsPanel open={jobsOpen} jobs={jobs} onClose={() => setJobsOpen(false)} onRefresh={refreshJobs} />
      <AboutPanel open={aboutOpen} info={appInfo} onResetTour={resetTour} onClose={() => setAboutOpen(false)} />
      <TourGuide
        run={tourRun}
        steps={tourSteps}
        onComplete={completeTour}
        onClose={completeTour}
      />
    </div >
  );
}

// ─── Utilities ───

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]} `;
}

function formatDuration(ms: number): string {
  if (ms === 0) return "0s";
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) return `${hours}h ${mins} m`;
  if (mins > 0) return `${mins}m ${secs} s`;
  return `${secs} s`;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
