import React, { startTransition, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, FolderOpen, Gauge, HelpCircle, ImageIcon, Maximize2, Pipette, RefreshCw, Trash2 } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  CalibrationChartDetection,
  CameraMatchAnalysis,
  CameraMatchAnalysisResult,
  CameraMatchDelta,
  CameraMatchMetrics,
  CameraMatchSuggestionSet,
  ProductionMatchLabRun,
  ProductionMatchLabRunSummary,
  ProductionProject,
} from "../../types";
import { exportProductionMatchSheetImage, exportProductionMatchSheetPdf } from "../../utils/ProductionExport";
import { invokeGuarded } from "../../utils/tauri";

interface CameraMatchLabAppProps {
  project: ProductionProject;
  onBack?: () => void;
}

const SLOT_ORDER = ["A", "B", "C"] as const;
const FRAME_COUNT = 5;
type CameraSlot = (typeof SLOT_ORDER)[number];
type MatchLabGuidanceItem = {
  id: string;
  priority: number;
  tone: "critical" | "warning" | "info" | "good";
  label: string;
  reason: string;
  slot?: string;
};
type MatchLabGuidanceAction =
  | { kind: "proxy"; label: string; slot: string }
  | { kind: "recalibrate"; label: string; slot: string }
  | { kind: "export"; label: string }
  | { kind: "analyze"; label: string };

export function CameraMatchLabApp({ project }: CameraMatchLabAppProps) {
  const [clipsBySlot, setClipsBySlot] = useState<Record<string, string>>({});
  const [analysisOverrideBySlot, setAnalysisOverrideBySlot] = useState<Record<string, string>>({});
  const [analysisBySlot, setAnalysisBySlot] = useState<Record<string, CameraMatchAnalysisResult>>({});
  const [frameDataUrls, setFrameDataUrls] = useState<Record<string, string>>({});
  const [frameWarnings, setFrameWarnings] = useState<Record<string, string>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [slotErrorDetails, setSlotErrorDetails] = useState<Record<string, string>>({});
  const [slotStatuses, setSlotStatuses] = useState<Record<string, string>>({});
  const [heroSlot, setHeroSlot] = useState<CameraSlot>("A");
  const [analyzing, setAnalyzing] = useState(false);
  const [activeSlots, setActiveSlots] = useState<string[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [framesOpenBySlot, setFramesOpenBySlot] = useState<Record<string, boolean>>({});
  const [runSummaries, setRunSummaries] = useState<ProductionMatchLabRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [hoveredRunId, setHoveredRunId] = useState<string | null>(null);
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<string | null>(null);
  const [deletingRun, setDeletingRun] = useState(false);
  const [runsMenuOpen, setRunsMenuOpen] = useState(false);
  const [savedRunMessage, setSavedRunMessage] = useState("");
  const [calibrationBySlot, setCalibrationBySlot] = useState<Record<string, CalibrationChartDetection>>({});
  const [calibratingSlots, setCalibratingSlots] = useState<Record<string, boolean>>({});
  const [fullscreenSlot, setFullscreenSlot] = useState<string | null>(null);
  const [previewModeBySlot, setPreviewModeBySlot] = useState<Record<string, "original" | "corrected" | "lut">>({});
  const [transformingSlots, setTransformingSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const loadFrames = async () => {
      const analyses = Object.entries(analysisBySlot);
      const calibrations = Object.entries(calibrationBySlot);
      if (analyses.length === 0 && calibrations.length === 0) {
        setFrameDataUrls({});
        return;
      }

      const nextUrls: Record<string, string> = {};
      const nextWarnings: Record<string, string> = {};

      for (const [slot, analysis] of analyses) {
        const uniqueFramePaths = new Set([
          analysis.representative_frame_path,
          ...analysis.frame_paths,
        ]);
        for (const framePath of uniqueFramePaths) {
          try {
            const dataUrl = await invokeGuarded<string>("read_thumbnail", { path: framePath });
            nextUrls[framePath] = dataUrl;
          } catch {
            if (!nextWarnings[slot]) {
              nextWarnings[slot] = "Some cached frames are missing. Re-run analysis.";
            }
          }
        }
      }

      for (const [slot, calibration] of calibrations) {
        if (!calibration.corrected_preview_path) continue;
        try {
          const dataUrl = await invokeGuarded<string>("read_thumbnail", { path: calibration.corrected_preview_path });
          nextUrls[calibration.corrected_preview_path] = dataUrl;
        } catch {
          if (!nextWarnings[slot]) {
            nextWarnings[slot] = "Corrected preview is missing. Recalibrate this camera.";
          }
        }
        if (calibration.transform_preview_path) {
          try {
            const dataUrl = await invokeGuarded<string>("read_thumbnail", { path: calibration.transform_preview_path });
            nextUrls[calibration.transform_preview_path] = dataUrl;
          } catch {
            if (!nextWarnings[slot]) {
              nextWarnings[slot] = "Transform preview is missing. Re-run calibration.";
            }
          }
        }
      }

      if (!cancelled) {
        startTransition(() => {
          setFrameDataUrls(nextUrls);
          setFrameWarnings((prev) => ({ ...prev, ...nextWarnings }));
        });
      }
    };

    void loadFrames();

    return () => {
      cancelled = true;
    };
  }, [analysisBySlot, calibrationBySlot]);

  const selectedSlots = useMemo(
    () => SLOT_ORDER.filter((slot) => Boolean(clipsBySlot[slot])),
    [clipsBySlot],
  );

  useEffect(() => {
    let cancelled = false;
    const loadRuns = async () => {
      try {
        const runs = await invokeGuarded<ProductionMatchLabRunSummary[]>("production_matchlab_list_runs", {
          projectId: project.id,
        });
        if (cancelled) return;
        setRunSummaries(runs);
        setSelectedRunId((current) => current ?? runs[0]?.run_id ?? null);
      } catch {
        if (!cancelled) {
          setRunSummaries([]);
        }
      }
    };
    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (!selectedRunId) return;
    let cancelled = false;
    const loadRun = async () => {
        try {
        const run = await invokeGuarded<ProductionMatchLabRun | null>("production_matchlab_get_run", {
          runId: selectedRunId,
        });
        if (!run || cancelled) return;
        const nextAnalyses: Record<string, CameraMatchAnalysisResult> = {};
        const nextClips: Record<string, string> = {};
        const nextCalibrations: Record<string, CalibrationChartDetection> = {};
        const nextPreviewModes: Record<string, "original" | "corrected" | "lut"> = {};
        run.results.forEach((result) => {
          nextAnalyses[result.slot] = result.analysis;
          nextClips[result.slot] = result.analysis.clip_path;
          if (result.calibration?.chart_detected) {
            nextCalibrations[result.slot] = result.calibration;
            nextPreviewModes[result.slot] = result.calibration.transform_preview_path ? "lut" : "corrected";
          }
        });
        startTransition(() => {
          setHeroSlot((run.hero_slot || "A") as CameraSlot);
          setAnalysisBySlot(nextAnalyses);
          setClipsBySlot((prev) => ({ ...prev, ...nextClips }));
          setAnalysisOverrideBySlot({});
          setFrameWarnings({});
          setSlotStatuses({});
          setSlotErrors({});
          setSlotErrorDetails({});
          setCalibrationBySlot(nextCalibrations);
          setPreviewModeBySlot(nextPreviewModes);
        });
      } catch {
        if (!cancelled) {
          setSavedRunMessage("Failed to load saved run.");
        }
      }
    };
    void loadRun();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    if (!savedRunMessage) return undefined;
    const timeout = window.setTimeout(() => setSavedRunMessage(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [savedRunMessage]);

  useEffect(() => {
    if (selectedSlots.includes(heroSlot)) return;
    if (selectedSlots.includes("A")) {
      setHeroSlot("A");
      return;
    }
    setHeroSlot(selectedSlots[0] ?? "A");
  }, [heroSlot, selectedSlots]);

  const persistCurrentRun = async (message: string) => {
    const resultEntries = SLOT_ORDER
      .filter((slot) => analysisBySlot[slot])
      .map((slot) => {
        const analysis = analysisBySlot[slot];
        return {
          slot,
          proxy_path: analysis.source_path !== analysis.clip_path ? analysis.source_path : null,
          analysis,
          calibration: calibrationBySlot[slot] ?? null,
        };
      });
    if (resultEntries.length === 0) return;
    const runId = await invokeGuarded<string>("production_matchlab_save_run", {
      projectId: project.id,
      heroSlot,
      results: resultEntries,
    });
    const runs = await invokeGuarded<ProductionMatchLabRunSummary[]>("production_matchlab_list_runs", {
      projectId: project.id,
    });
    startTransition(() => {
      setRunSummaries(runs);
      setSelectedRunId(runId);
      setSavedRunMessage(message);
    });
  };

  useEffect(() => {
    const heroCalibration = calibrationBySlot[heroSlot];
    if (!heroCalibration?.chart_detected) return;
    let cancelled = false;

    const refreshTransforms = async () => {
      let didChange = false;
      for (const slot of SLOT_ORDER) {
        const calibration = calibrationBySlot[slot];
        const analysis = analysisBySlot[slot];
        if (!calibration?.chart_detected || !analysis?.representative_frame_path) continue;
        if (slot === heroSlot) {
          if (
            calibration.calibration_transform ||
            calibration.lut_path ||
            calibration.transform_preview_path ||
            calibration.transform_target_slot !== heroSlot ||
            calibration.mean_delta_e_before !== calibration.mean_delta_e
          ) {
            didChange = true;
            startTransition(() => {
              setCalibrationBySlot((prev) => ({
                ...prev,
                [slot]: {
                  ...prev[slot],
                  calibration_transform: null,
                  lut_path: null,
                  cube_size: null,
                  transform_type: null,
                  transform_target_slot: heroSlot,
                  mean_delta_e_before: prev[slot].mean_delta_e,
                  mean_delta_e_after: null,
                  transform_preview_path: null,
                },
              }));
              setPreviewModeBySlot((prev) => ({ ...prev, [slot]: "corrected" }));
            });
          }
          continue;
        }
        if (
          calibration.transform_target_slot === heroSlot &&
          calibration.transform_preview_path &&
          calibration.calibration_transform
        ) {
          continue;
        }

        startTransition(() => {
          setTransformingSlots((prev) => ({ ...prev, [slot]: true }));
          setSlotStatuses((prev) => ({ ...prev, [slot]: "Building LUT..." }));
        });
        try {
          const transformed = await invokeGuarded<CalibrationChartDetection>("production_matchlab_generate_transform", {
            projectId: project.id,
            slot,
            heroSlot,
            sourceFramePath: analysis.representative_frame_path,
            sourceCalibration: calibration,
            targetCalibration: heroCalibration,
          });
          if (cancelled) return;
          didChange = true;
          startTransition(() => {
            setCalibrationBySlot((prev) => ({ ...prev, [slot]: transformed }));
            setPreviewModeBySlot((prev) => ({ ...prev, [slot]: transformed.transform_preview_path ? "lut" : "corrected" }));
            setSlotStatuses((prev) => ({ ...prev, [slot]: "Calibration ready" }));
          });
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : String(error);
          startTransition(() => {
            setSlotErrors((prev) => ({ ...prev, [slot]: message.split("\n")[0] }));
            setSlotErrorDetails((prev) => ({ ...prev, [slot]: message }));
          });
        } finally {
          if (!cancelled) {
            startTransition(() => {
              setTransformingSlots((prev) => {
                const next = { ...prev };
                delete next[slot];
                return next;
              });
            });
          }
        }
      }
      if (!cancelled && didChange) {
        try {
          await persistCurrentRun("Saved calibration");
        } catch {
          // Keep the calibration visible even if snapshot persistence fails.
        }
      }
    };

    void refreshTransforms();

    return () => {
      cancelled = true;
    };
  }, [analysisBySlot, calibrationBySlot, heroSlot, project.id]);

  const matchResult = useMemo(() => {
    const analyses = SLOT_ORDER
      .filter((slot) => analysisBySlot[slot])
      .map((slot) => buildAnalysisModel(slot, analysisBySlot[slot], heroSlot, analysisBySlot[heroSlot]));
    return {
      analyses,
      hero_slot: heroSlot,
      generated_at: new Date().toISOString(),
    };
  }, [analysisBySlot, heroSlot]);

  const guidance = useMemo(() => buildMatchLabGuidance({
    clipsBySlot,
    analysisBySlot,
    calibrationBySlot,
    slotErrors,
    heroSlot,
    analyses: matchResult.analyses,
    analysisOverrideBySlot,
    selectedSlots,
  }), [analysisBySlot, analysisOverrideBySlot, calibrationBySlot, clipsBySlot, heroSlot, matchResult.analyses, selectedSlots, slotErrors]);

  const pickClip = async (slot: string) => {
    const selected = await open({
      multiple: false,
      title: `Select camera ${slot} test clip`,
      filters: [{
        name: "Video",
        extensions: ["mov", "mp4", "mxf", "mkv", "avi", "braw", "r3d", "nev"],
      }],
    });
    if (typeof selected !== "string") return;
    setClipsBySlot((prev) => ({ ...prev, [slot]: selected }));
    setAnalysisOverrideBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSelectedRunId(null);
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotErrorDetails((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setFrameWarnings((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotStatuses((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setCalibrationBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setPreviewModeBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    if (isProxyOnlyRawClip(selected)) {
      setSlotStatuses((prev) => ({ ...prev, [slot]: `${getProxyOnlyFormatBadge(selected)} detected · Proxy required` }));
    }
  };

  const clearSlot = (slot: string) => {
    setSelectedRunId(null);
    setClipsBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setAnalysisBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setAnalysisOverrideBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setFrameWarnings((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotErrorDetails((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setSlotStatuses((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setCalibrationBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setCalibratingSlots((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    setPreviewModeBySlot((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const calibrateSlot = async (slot: string, framePath?: string) => {
    if (!framePath) return;
    setCalibratingSlots((prev) => ({ ...prev, [slot]: true }));
    try {
      const result = await invokeGuarded<CalibrationChartDetection>("production_matchlab_detect_calibration", {
        projectId: project.id,
        slot,
        framePath,
      });
      startTransition(() => {
        setCalibrationBySlot((prev) => ({ ...prev, [slot]: result }));
        setPreviewModeBySlot((prev) => ({ ...prev, [slot]: "corrected" }));
        setSlotStatuses((prev) => ({ ...prev, [slot]: "Calibration ready" }));
        setSlotErrors((prev) => {
          const next = { ...prev };
          delete next[slot];
          return next;
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      startTransition(() => {
        setSlotErrors((prev) => ({ ...prev, [slot]: message.split("\n")[0] }));
        setSlotErrorDetails((prev) => ({ ...prev, [slot]: message }));
      });
    } finally {
      setCalibratingSlots((prev) => ({ ...prev, [slot]: false }));
    }
  };

  const analyzeClips = async () => {
    if (selectedSlots.length === 0) return;
    setAnalyzing(true);
    setActiveSlots(selectedSlots);
    setSlotErrors({});
    setSlotErrorDetails({});
    setSelectedRunId(null);
    const nextResults: Array<{ slot: string; proxy_path?: string | null; analysis: CameraMatchAnalysisResult; calibration?: CalibrationChartDetection | null }> = [];

    try {
      for (const slot of selectedSlots) {
        const clipPath = clipsBySlot[slot];
        if (!clipPath) continue;
        if (isProxyOnlyRawClip(clipPath) && !analysisOverrideBySlot[slot]) {
          const formatLabel = getProxyOnlyFormatBadge(clipPath);
          startTransition(() => {
            setSlotStatuses((prev) => ({ ...prev, [slot]: "Proxy required" }));
            setSlotErrors((prev) => ({ ...prev, [slot]: "Proxy required for analysis" }));
            setSlotErrorDetails((prev) => ({
              ...prev,
              [slot]: `${formatLabel} source selected. This format is accepted in Match Lab, but analysis runs through an operator-selected MP4 or MOV proxy.`,
            }));
          });
          continue;
        }
        try {
          if (isBrawClip(clipPath)) {
            startTransition(() => {
              setSlotStatuses((prev) => ({ ...prev, [slot]: "Preparing proxy..." }));
            });
          }
          startTransition(() => {
            setSlotStatuses((prev) => ({ ...prev, [slot]: "Analyzing..." }));
          });
          const result = await invokeGuarded<CameraMatchAnalysisResult>("camera_match_analyze_clip", {
            projectId: project.id,
            cameraSlot: slot,
            clipPath,
            frameCount: FRAME_COUNT,
            analysisSourceOverridePath: analysisOverrideBySlot[slot] ?? null,
          });
          const proxyPath = result.source_path !== clipPath ? result.source_path : undefined;
          nextResults.push({
            slot,
            proxy_path: proxyPath,
            analysis: { ...result, clip_path: clipPath },
            calibration: calibrationBySlot[slot] ?? null,
          });
          startTransition(() => {
            setAnalysisBySlot((prev) => ({ ...prev, [slot]: { ...result, clip_path: clipPath } }));
            setSlotStatuses((prev) => ({ ...prev, [slot]: "Ready" }));
            setSlotErrors((prev) => {
              const next = { ...prev };
              delete next[slot];
              return next;
            });
            setSlotErrorDetails((prev) => {
              const next = { ...prev };
              delete next[slot];
              return next;
            });
          });
        } catch (slotError) {
          const message = slotError instanceof Error ? slotError.message : String(slotError);
          const parsedError = parseStructuredError(message);
          const errorSummary = parsedError.summary || message.split("\n")[0];
          const errorDetails = parsedError.details;
          startTransition(() => {
            setSlotErrors((prev) => ({ ...prev, [slot]: errorSummary }));
            setSlotErrorDetails((prev) => {
              if (!errorDetails) {
                const next = { ...prev };
                delete next[slot];
                return next;
              }
              return { ...prev, [slot]: errorDetails };
            });
            setSlotStatuses((prev) => {
              const next = { ...prev };
              delete next[slot];
              return next;
            });
            setAnalysisBySlot((prev) => {
              const next = { ...prev };
              delete next[slot];
              return next;
            });
          });
        }
      }
      if (nextResults.length > 0) {
        const runId = await invokeGuarded<string>("production_matchlab_save_run", {
          projectId: project.id,
          heroSlot,
          results: nextResults,
        });
        const runs = await invokeGuarded<ProductionMatchLabRunSummary[]>("production_matchlab_list_runs", {
          projectId: project.id,
        });
        startTransition(() => {
          setRunSummaries(runs);
          setSelectedRunId(runId);
          setSavedRunMessage("Saved run");
        });
      }
    } finally {
      setAnalyzing(false);
      setActiveSlots([]);
    }
  };

  const exportMatchSheet = async (kind: "pdf" | "image") => {
    setExportMenuOpen(false);
    const exportPayload = {
      fileName: `${project.name}_MatchLab_${heroSlot}.${kind === "pdf" ? "pdf" : "jpg"}`,
      title: "Match Sheet",
      projectName: project.name,
      clientName: project.client_name,
      heroSlot,
      generatedAt: matchResult.generated_at,
      cameras: matchResult.analyses.map((analysis) => ({
        slot: analysis.slot,
        title: analysis.clip_name,
        frameDataUrl: frameDataUrls[analysis.representative_frame_path] ?? "",
        metrics: analysis.metrics,
        delta: analysis.delta_vs_hero ?? null,
        suggestions: analysis.suggestions ?? null,
        calibration: calibrationBySlot[analysis.slot] ?? null,
      })),
    };
    if (kind === "pdf") {
      await exportProductionMatchSheetPdf(exportPayload);
      return;
    }
    await exportProductionMatchSheetImage(exportPayload);
  };

  const exportSlotLut = async (slot: string, calibration: CalibrationChartDetection) => {
    if (!calibration.lut_path) {
      setSavedRunMessage("No LUT available for this camera.");
      return;
    }
    const defaultName = calibration.lut_path.split("/").pop() || `camera_${slot.toLowerCase()}_to_${heroSlot.toLowerCase()}.cube`;
    const destination = await save({
      title: `Export Camera ${slot} LUT`,
      defaultPath: defaultName,
      filters: [{ name: "LUT", extensions: ["cube"] }],
    });
    if (typeof destination !== "string") return;
    await invokeGuarded("production_matchlab_export_lut", {
      lutPath: calibration.lut_path,
      destinationPath: destination,
    });
    setSavedRunMessage(`Exported LUT for camera ${slot}`);
  };

  const exportSlotMonitorLut = async (slot: string, calibration: CalibrationChartDetection) => {
    if (!calibration.lut_path) {
      setSavedRunMessage("No LUT available for this camera.");
      return;
    }
    const defaultName = `camera_${slot.toLowerCase()}_to_${heroSlot.toLowerCase()}_monitor.cube`;
    const destination = await save({
      title: `Export Camera ${slot} Monitor LUT`,
      defaultPath: defaultName,
      filters: [{ name: "LUT", extensions: ["cube"] }],
    });
    if (typeof destination !== "string") return;
    await invokeGuarded("production_matchlab_export_lut", {
      lutPath: calibration.lut_path,
      destinationPath: destination,
    });
    setSavedRunMessage(`Exported monitor LUT for camera ${slot}`);
  };

  const exportCalibrationPackage = async () => {
    if (!selectedRunId) {
      setSavedRunMessage("Save a run before exporting the calibration package.");
      return;
    }
    const packagePath = await invokeGuarded<string>("production_matchlab_export_calibration_package", {
      projectId: project.id,
      runId: selectedRunId,
    });
    setSavedRunMessage(`Calibration package ready: ${getFileName(packagePath)}`);
  };

  const pickExistingProxy = async (slot: string) => {
    const selected = await open({
      multiple: false,
      title: `Select existing MP4 or MOV proxy for camera ${slot}`,
      filters: [{ name: "Proxy", extensions: ["mp4", "mov"] }],
    });
    if (typeof selected !== "string") return;
    setAnalysisOverrideBySlot((prev) => ({ ...prev, [slot]: selected }));
    setSlotStatuses((prev) => ({ ...prev, [slot]: "Proxy selected" }));
  };

  const confirmDeleteRun = async () => {
    if (!pendingDeleteRunId || deletingRun) return;
    setDeletingRun(true);
    try {
      const warning = await invokeGuarded<string | null>("production_matchlab_delete_run", {
        runId: pendingDeleteRunId,
      });
      const runs = await invokeGuarded<ProductionMatchLabRunSummary[]>("production_matchlab_list_runs", {
        projectId: project.id,
      });
      startTransition(() => {
        setRunSummaries(runs);
        if (selectedRunId === pendingDeleteRunId) {
          const nextSelected = runs[0]?.run_id ?? null;
          setSelectedRunId(nextSelected);
          if (!nextSelected) {
            setAnalysisBySlot({});
            setFrameDataUrls({});
            setFrameWarnings({});
            setSlotErrors({});
            setSlotErrorDetails({});
          }
        }
        setSavedRunMessage(warning || "Run deleted");
        setPendingDeleteRunId(null);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSavedRunMessage(message);
    } finally {
      setDeletingRun(false);
    }
  };

  const pendingRun = runSummaries.find((run) => run.run_id === pendingDeleteRunId) ?? null;
  const selectedRunSummary = runSummaries.find((run) => run.run_id === selectedRunId) ?? null;

  return (
    <div className="scrollable-view" style={{ padding: 24 }}>
      <div className="production-matchlab-shell" style={matchLabLayoutStyle}>
        <main style={{ minWidth: 0, paddingBottom: 48 }}>
          <div style={headerRowStyle}>
            <div style={headerTitleRowStyle}>
              <div style={headerTitleStyle}>Camera Match Lab</div>
              <div style={subtleStyle}>Measured match sheet. {FRAME_COUNT} frames per clip.</div>
            </div>
            <div className="production-matchlab-header-utility" style={headerUtilityRowStyle}>
              <div style={headerMetaClusterStyle}>
                <div style={headerInfoBlockStyle}>
                  <div style={headerProjectNameStyle}>Project {project.name}</div>
                </div>
                <div className="production-matchlab-header-capsule" style={headerCapsuleStyle}>
                  <div style={headerControlGroupStyle}>
                    <span style={headerControlLabelStyle}>Hero</span>
                    <div style={heroInlineStyle}>
                      {SLOT_ORDER.filter((slot) => clipsBySlot[slot]).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`btn btn-sm ${heroSlot === slot ? "production-matchlab-hero-active" : "btn-ghost"}`}
                          onClick={() => setHeroSlot(slot)}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={capsuleDividerStyle} />
                  <div style={{ position: "relative", minWidth: 0 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm production-matchlab-run-chip"
                      style={runChipStyle}
                      onClick={() => setRunsMenuOpen((prev) => !prev)}
                    >
                      <span style={runChipLabelStyle}>Run:</span>
                      <span style={runChipValueStyle}>{selectedRunSummary ? formatRunTimestamp(selectedRunSummary.created_at) : "No saved runs"}</span>
                      <ChevronDown size={14} />
                    </button>
                    {runsMenuOpen && (
                      <div className="production-matchlab-runs-menu" style={runsPopoverStyle}>
                        {runSummaries.length === 0 ? (
                          <div style={runsEmptyStyle}>No saved runs</div>
                        ) : (
                          runSummaries.map((run) => (
                            <div
                              key={run.run_id}
                              style={{
                                ...runItemStyle,
                                ...(selectedRunId === run.run_id ? runItemActiveStyle : null),
                              }}
                              onMouseEnter={() => setHoveredRunId(run.run_id)}
                              onMouseLeave={() => setHoveredRunId((current) => (current === run.run_id ? null : current))}
                            >
                              <button
                                type="button"
                                style={runSelectButtonStyle}
                                onClick={() => {
                                  setSelectedRunId(run.run_id);
                                  setRunsMenuOpen(false);
                                }}
                              >
                                <div style={runItemTitleStyle}>{formatRunTimestamp(run.created_at)}</div>
                                <div style={runItemMetaStyle}>Hero {run.hero_slot}</div>
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete run ${formatRunTimestamp(run.created_at)}`}
                                style={{
                                  ...runDeleteButtonStyle,
                                  opacity: hoveredRunId === run.run_id ? 1 : 0.18,
                                }}
                                onClick={() => {
                                  setPendingDeleteRunId(run.run_id);
                                  setRunsMenuOpen(false);
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="production-matchlab-header-actions" style={headerActionsStyle}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm production-matchlab-analyze-button"
                  onClick={() => void analyzeClips()}
                  disabled={selectedSlots.length === 0 || analyzing || activeSlots.length > 0}
                >
                  <RefreshCw size={14} /> {analyzing ? "Analyzing..." : "Analyze"}
                </button>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    disabled={matchResult.analyses.length === 0}
                  >
                    <Download size={14} /> Export <ChevronDown size={14} />
                  </button>
                  {exportMenuOpen && (
                    <div className="production-matchlab-export-menu" style={exportMenuStyle}>
                      <button type="button" className="production-matchlab-export-item" style={exportItemStyle} onClick={() => void exportMatchSheet("pdf")}>Export Match Sheet (PDF)</button>
                      <button type="button" className="production-matchlab-export-item" style={exportItemStyle} onClick={() => void exportMatchSheet("image")}>Export Match Sheet (Image)</button>
                      <button type="button" className="production-matchlab-export-item" style={exportItemStyle} onClick={() => void exportCalibrationPackage()}>Export Calibration Package</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <section className="matchLabGrid" style={gridStyle}>
            {SLOT_ORDER.map((slot) => {
              const clipPath = clipsBySlot[slot];
              const analysis = matchResult.analyses.find((item) => item.slot === slot);
              const rawAnalysis = analysisBySlot[slot];
              const representativeFrameUrl = rawAnalysis ? frameDataUrls[rawAnalysis.representative_frame_path] : "";
              const frameWarning = frameWarnings[slot];
              const analysisWarning = rawAnalysis?.warnings?.[0];
              const slotError = slotErrors[slot];
              const slotErrorDetail = slotErrorDetails[slot];
              const slotStatus = slotStatuses[slot];
              const active = activeSlots.includes(slot);
              const calibration = calibrationBySlot[slot];
              const heroCalibration = calibrationBySlot[heroSlot];
              const correctionDisplay = calibration ? buildCalibrationDisplay(calibration, heroCalibration, slot === heroSlot) : null;
              const previewMode = previewModeBySlot[slot] ?? "original";
              const correctedPreviewUrl = calibration?.corrected_preview_path ? frameDataUrls[calibration.corrected_preview_path] : "";
              const transformPreviewUrl = calibration?.transform_preview_path ? frameDataUrls[calibration.transform_preview_path] : "";
              const activePreviewUrl =
                previewMode === "lut" && transformPreviewUrl
                  ? transformPreviewUrl
                  : previewMode === "corrected" && correctedPreviewUrl
                    ? correctedPreviewUrl
                    : representativeFrameUrl;
              const activePreviewLabel =
                previewMode === "lut" && transformPreviewUrl
                  ? "LUT Preview"
                  : previewMode === "corrected" && correctedPreviewUrl
                    ? "Corrected"
                    : "Original";

              return (
                <div key={slot} className="matchLabColumn" style={cameraColumnStyle}>
                  <div className="matchLabCard" style={cameraCardStyle}>
                    <div style={slotHeaderRowStyle}>
                      <span style={{ ...slotBadgeStyle, ...slotBadgeColor(slot) }}>Camera {slot}</span>
                      {heroSlot === slot && <span style={heroChipStyle}>Hero</span>}
                    </div>
                    <div className="matchLabCameraActions" style={cameraActionsWrapStyle}>
                      <div style={cameraActionsTopRowStyle}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void pickClip(slot)}>
                          <FolderOpen size={14} /> {clipPath ? "Replace" : "Import Clip"}
                        </button>
                        {clipPath ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => clearSlot(slot)}>Clear</button>
                        ) : (
                          <span style={actionPlaceholderStyle} aria-hidden="true" />
                        )}
                        {rawAnalysis?.representative_frame_path ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void calibrateSlot(slot, rawAnalysis.representative_frame_path)}
                            disabled={Boolean(calibratingSlots[slot])}
                          >
                            <Pipette size={14} /> {calibratingSlots[slot] ? "Calibrating..." : "Calibrate"}
                          </button>
                        ) : (
                          <span style={actionPlaceholderStyle} aria-hidden="true" />
                        )}
                      </div>
                      <div style={cameraActionsSupportRowStyle}>
                        {isProxyOnlyRawClip(clipPath || "") ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void pickExistingProxy(slot)}>
                            <FolderOpen size={14} /> Use existing MP4/MOV proxy…
                          </button>
                        ) : (
                          <span style={supportRowPlaceholderStyle} aria-hidden="true" />
                        )}
                      </div>
                    </div>
                    <div className="matchLabPathPrimary" style={fileMetaStyle} title={clipPath ? getFileName(clipPath) : "No clip selected"}>{clipPath ? getFileName(clipPath) : "No clip selected"}</div>
                    <div className="matchLabPathSecondary" style={helperMetaStyle} title={clipPath || "One short test clip per camera."}>{clipPath || "One short test clip per camera."}</div>
                    {isProxyOnlyRawClip(clipPath || "") ? (
                      <div style={sourceMetaRowStyle}>
                        <span style={sourceBadgeStyle}>{getProxyOnlyFormatBadge(clipPath || "")}</span>
                        <span style={sourceMetaTextStyle}>{analysisOverrideBySlot[slot] ? "Proxy attached" : "Proxy required"}</span>
                      </div>
                    ) : null}
                    {analysisOverrideBySlot[slot] ? (
                      <div style={sourceMetaInlineStyle} title={analysisOverrideBySlot[slot]}>
                        Using proxy · {getFileName(analysisOverrideBySlot[slot])}
                      </div>
                    ) : null}
                    {slotStatus ? <div style={statusMetaStyle}>{slotStatus}</div> : null}
                  </div>

                  <div className="matchLabCard matchLabAnalysisCard" style={analysisCardStyle}>
                    {slotError && (
                      <div style={errorCardStyle}>
                        <div>{slotError}</div>
                        {isBrawClip(clipPath || "") || isProxyOnlyRawClip(clipPath || "") ? (
                          <div style={errorActionsStyle}>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void pickExistingProxy(slot)} disabled={active}>
                              <FolderOpen size={14} /> Use existing MP4/MOV proxy…
                            </button>
                          </div>
                        ) : null}
                        {slotErrorDetail ? (
                          <details style={errorDetailsStyle}>
                            <summary style={errorDetailsSummaryStyle}>Details</summary>
                            <pre style={errorDetailsBodyStyle}>{slotErrorDetail}</pre>
                          </details>
                        ) : null}
                      </div>
                    )}
                    {analysis && rawAnalysis && representativeFrameUrl ? (
                      <>
                        {calibration?.chart_detected ? (
                          <div style={previewToggleRowStyle}>
                            <button
                              type="button"
                              className={`btn btn-sm ${previewMode === "original" ? "btn-secondary" : "btn-ghost"}`}
                              onClick={() => setPreviewModeBySlot((prev) => ({ ...prev, [slot]: "original" }))}
                            >
                              Original
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${previewMode === "corrected" ? "btn-secondary" : "btn-ghost"}`}
                              onClick={() => setPreviewModeBySlot((prev) => ({ ...prev, [slot]: "corrected" }))}
                              disabled={!correctedPreviewUrl}
                            >
                              Corrected
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${previewMode === "lut" ? "btn-secondary" : "btn-ghost"}`}
                              onClick={() => setPreviewModeBySlot((prev) => ({ ...prev, [slot]: "lut" }))}
                              disabled={!transformPreviewUrl}
                            >
                              LUT Preview
                            </button>
                            <span style={previewToggleLabelStyle}>{activePreviewLabel}</span>
                          </div>
                        ) : null}
                        <div className="matchLabFrameWrap" style={frameWrapStyle}>
                          <img className="matchLabFrameImage" src={activePreviewUrl} alt={`${slot} representative frame`} style={frameImageStyle} />
                          {previewMode === "original" && calibration?.chart_detected ? <CalibrationOverlay calibration={calibration} /> : null}
                          <div style={frameOverlayStyle}>
                            <HistogramOverlay histogram={analysis.metrics.luma_histogram} />
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={frameExpandButtonStyle}
                            onClick={() => setFullscreenSlot(slot)}
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                        {(frameWarning || analysisWarning) && <div style={inlineWarningStyle}>{frameWarning || analysisWarning}</div>}
                        {calibration?.chart_detected ? (
                          <div style={calibrationStripStyle}>
                          <div style={calibrationHeaderStyle}>
                              <span style={chipLabelStyle}>Calibration</span>
                              <div style={calibrationHeaderMetaStyle}>
                                <span style={qualitySummaryStyle}>Quality {calibration.calibration_quality_score} · {calibration.calibration_quality_level}</span>
                                <span style={{ ...qualityLevelChipStyle, ...qualityLevelStyle(calibration.calibration_quality_level) }}>
                                  {calibration.calibration_quality_level}
                                </span>
                              </div>
                            </div>
                            <div style={qualityBandStyle}>
                              <div style={{ ...qualityFillStyle, ...qualityLevelFillStyle(calibration.calibration_quality_level), width: `${Math.max(calibration.calibration_quality_score, 10)}%` }} />
                            </div>
                            {calibration.warnings.length > 0 ? (
                              <div style={warningBadgeRowStyle}>
                                {calibration.warnings.slice(0, 2).map((warning) => (
                                  <span key={warning} style={warningBadgeStyle}>
                                    {compactWarningLabel(warning)}
                                  </span>
                                ))}
                                {calibration.warnings.length > 2 ? (
                                  <span style={warningBadgeStyle}>+{calibration.warnings.length - 2} more</span>
                                ) : null}
                              </div>
                            ) : null}
                            {correctionDisplay ? (
                              <div style={metricsWrapStyle}>
                                <SuggestionChip label="Exposure" value={correctionDisplay.exposure} />
                                <SuggestionChip label="WB" value={correctionDisplay.whiteBalance} />
                                <SuggestionChip label="Tint" value={correctionDisplay.tint} />
                                <SuggestionChip label="dE Before" value={calibration.mean_delta_e_before.toFixed(1)} />
                                <SuggestionChip label="dE After" value={calibration.mean_delta_e_after?.toFixed(1) ?? "—"} />
                                <SuggestionChip label="Improve" value={formatImprovement(calibration.mean_delta_e_before, calibration.mean_delta_e_after)} />
                              </div>
                            ) : null}
                            <div style={metricsWrapStyle}>
                              <SuggestionChip label="Neutral dE" value={calibration.neutral_mean_delta_e.toFixed(1)} />
                              <SuggestionChip label="Skin dE" value={calibration.skin_mean_delta_e.toFixed(1)} />
                              <SuggestionChip label="Max dE" value={calibration.max_delta_e.toFixed(1)} />
                              <SuggestionChip label="LUT" value={calibration.lut_path ? getFileName(calibration.lut_path) : slot === heroSlot ? "Hero baseline" : "Pending"} />
                            </div>
                            {calibration.transform_quality_flag ? (
                              <div style={inlineWarningStyle}>{calibration.transform_quality_flag}</div>
                            ) : null}
                            {slot !== heroSlot ? (
                              <div style={errorActionsStyle}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => void exportSlotLut(slot, calibration)}
                                  disabled={!calibration.lut_path || Boolean(transformingSlots[slot])}
                                >
                                  <Download size={14} /> Export LUT
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => void exportSlotMonitorLut(slot, calibration)}
                                  disabled={!calibration.lut_path || Boolean(transformingSlots[slot])}
                                >
                                  <Download size={14} /> Export Monitor LUT
                                </button>
                              </div>
                            ) : null}
                            <div style={patchGridStyle}>
                              {calibration.patch_samples.map((patch) => (
                                <PatchDeltaSwatch key={patch.patch_index} patch={patch} />
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div style={metricsWrapStyle}>
                          <MetricChip label="Luma" value={formatPercent(analysis.metrics.luma_median)} />
                          <MetricChip label="RGB" value={formatRgbTriplet(analysis.metrics.rgb_medians)} />
                          <MetricChip label="Hi %" value={formatPercent(analysis.metrics.highlight_percent)} />
                          <MetricChip label="Mid %" value={formatPercent(analysis.metrics.midtone_density)} />
                        </div>
                        <div style={deltaRowStyle}>
                          <DeltaChip label="Delta Luma" value={analysis.delta_vs_hero ? formatSignedPercent(analysis.delta_vs_hero.luma_median) : "Hero"} />
                          <DeltaChip label="Delta Hi" value={analysis.delta_vs_hero ? formatSignedPercent(analysis.delta_vs_hero.highlight_percent) : "Hero"} />
                          <DeltaChip label="Delta Mid" value={analysis.delta_vs_hero ? formatSignedPercent(analysis.delta_vs_hero.midtone_density) : "Hero"} />
                        </div>
                        <div style={metricsWrapStyle}>
                          <SuggestionChip label="Exposure" value={analysis.suggestions?.exposure ?? "Hero baseline"} />
                          <SuggestionChip label="WB" value={analysis.suggestions?.white_balance ?? "Hero baseline"} />
                          <SuggestionChip label="Highlights" value={analysis.suggestions?.highlight ?? "Hero baseline"} />
                          <SuggestionChip label="Confidence" value={analysis.suggestions?.confidence ?? "Low"} />
                        </div>
                        {analysis.suggestions?.warning ? <div style={inlineWarningStyle}>{analysis.suggestions.warning}</div> : null}
                        <details style={detailsWrapStyle}>
                          <summary style={detailsSummaryStyle}>
                            <ImageIcon size={14} /> Frames & Details
                          </summary>
                          {rawAnalysis.proxy_info ? (
                            <div style={detailsMetaLineStyle}>
                              <span style={rawMetricsLabelStyle}>Proxy info</span>
                              <span style={detailsMetaValueStyle}>{rawAnalysis.proxy_info}</span>
                            </div>
                          ) : null}
                          <div style={framesGridStyle}>
                            {rawAnalysis.frame_paths.map((framePath) => (
                              <button
                                key={framePath}
                                type="button"
                                style={frameThumbButtonStyle}
                                onClick={() => setFramesOpenBySlot((prev) => ({ ...prev, [slot]: !prev[slot] }))}
                              >
                                {frameDataUrls[framePath] ? (
                                  <img src={frameDataUrls[framePath]} alt={`${slot} frame`} style={frameThumbStyle} />
                                ) : (
                                  <div style={frameThumbPlaceholderStyle}>Missing</div>
                                )}
                              </button>
                            ))}
                          </div>
                          {framesOpenBySlot[slot] && (
                            <div style={detailsDrawerStyle}>
                              <div style={rawMetricsGridStyle}>
                                {rawAnalysis.per_frame.map((frame) => (
                                  <div key={frame.frame_index} style={rawMetricsCardStyle}>
                                    <div style={rawMetricsTitleStyle}>Frame {frame.frame_index + 1}</div>
                                    <div style={rawMetricsLineStyle}>
                                      <span style={rawMetricsLabelStyle}>Time</span>
                                      <span style={rawMetricsValueStyle}>{Math.round(frame.timestamp_ms / 1000)}s</span>
                                    </div>
                                    <div style={rawMetricsLineStyle}>
                                      <span style={rawMetricsLabelStyle}>Luma</span>
                                      <span style={rawMetricsValueStyle}>{formatPercent(frame.luma_median)}</span>
                                    </div>
                                    <div style={rawMetricsLineStyle}>
                                      <span style={rawMetricsLabelStyle}>RGB</span>
                                      <span style={rawMetricsValueStyle}>{formatRgbTriplet(frame.rgb_medians)}</span>
                                    </div>
                                    <div style={rawMetricsLineStyle}>
                                      <span style={rawMetricsLabelStyle}>Hi</span>
                                      <span style={rawMetricsValueStyle}>{formatPercent(frame.highlight_percent)}</span>
                                    </div>
                                    <div style={rawMetricsLineStyle}>
                                      <span style={rawMetricsLabelStyle}>Mid</span>
                                      <span style={rawMetricsValueStyle}>{formatPercent(frame.midtone_density)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </details>
                      </>
                    ) : (
                      <div style={placeholderStyle}>
                        <Gauge size={18} />
                        <span>{active ? (slotStatus || "Analyzing clip...") : clipPath ? "Run analysis to measure this camera." : "Import a clip to compare this camera."}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
          {guidance.items.length > 0 ? (
            <section style={guidanceSectionStyle}>
              <div style={guidanceHeaderStyle}>
                <div style={guidanceTitleStyle}>How to use this result</div>
              </div>
              <div style={guidanceListStyle}>
                {guidance.items.slice(0, 4).map((item) => (
                  <div key={item.id} style={guidanceRowStyle}>
                    <div style={guidanceRowMainStyle}>
                      <div style={guidanceRowTopStyle}>
                        {item.slot ? (
                          <span style={{ ...slotBadgeStyle, ...slotBadgeColor(item.slot), minWidth: 26, height: 22, padding: "0 8px" }}>
                            {item.slot}
                          </span>
                        ) : null}
                        <span style={{ ...guidanceToneDotStyle, ...guidanceToneDotColor(item.tone) }} />
                        <span style={guidanceLabelStyle}>{item.label}</span>
                      </div>
                    </div>
                    <span title={item.reason} style={guidanceHelpStyle}>
                      <HelpCircle size={13} />
                    </span>
                  </div>
                ))}
                {guidance.items.length > 4 ? (
                  <div style={guidanceMoreStyle}>+{guidance.items.length - 4} more</div>
                ) : null}
              </div>
              <div style={guidanceActionRowStyle}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!guidance.action) return;
                    if (guidance.action.kind === "proxy") {
                      void pickExistingProxy(guidance.action.slot);
                      return;
                    }
                    if (guidance.action.kind === "recalibrate") {
                      const framePath = analysisBySlot[guidance.action.slot]?.representative_frame_path;
                      if (framePath) {
                        void calibrateSlot(guidance.action.slot, framePath);
                      }
                      return;
                    }
                    if (guidance.action.kind === "export") {
                      setExportMenuOpen(true);
                      return;
                    }
                    void analyzeClips();
                  }}
                >
                  {guidance.action?.label ?? "Review results"}
                </button>
              </div>
            </section>
          ) : null}
        </main>
      </div>
      {pendingRun ? (
        <div style={modalBackdropStyle} onClick={() => (!deletingRun ? setPendingDeleteRunId(null) : undefined)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={modalTitleStyle}>Delete run?</div>
            <div style={modalBodyStyle}>This removes the saved analysis and cached frames for this run.</div>
                <div style={modalMetaStyle}>{formatRunTimestamp(pendingRun.created_at)} · Hero {pendingRun.hero_slot}</div>
            <div style={modalActionsStyle}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDeleteRunId(null)} disabled={deletingRun}>Cancel</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void confirmDeleteRun()} disabled={deletingRun}>
                <Trash2 size={14} /> {deletingRun ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {fullscreenSlot && analysisBySlot[fullscreenSlot] ? (
        <div style={modalBackdropStyle} onClick={() => setFullscreenSlot(null)}>
          <div style={fullscreenCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={fullscreenHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Calibration Preview · Camera {fullscreenSlot}</div>
                <div style={modalMetaStyle}>{getFileName(analysisBySlot[fullscreenSlot].clip_path)}</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFullscreenSlot(null)}>Close</button>
            </div>
            <div style={fullscreenFrameWrapStyle}>
              <img
                src={previewModeBySlot[fullscreenSlot] === "corrected" && calibrationBySlot[fullscreenSlot]?.corrected_preview_path
                  ? frameDataUrls[calibrationBySlot[fullscreenSlot].corrected_preview_path] || frameDataUrls[analysisBySlot[fullscreenSlot].representative_frame_path]
                  : previewModeBySlot[fullscreenSlot] === "lut" && calibrationBySlot[fullscreenSlot]?.transform_preview_path
                    ? frameDataUrls[calibrationBySlot[fullscreenSlot].transform_preview_path!] || frameDataUrls[analysisBySlot[fullscreenSlot].representative_frame_path]
                    : frameDataUrls[analysisBySlot[fullscreenSlot].representative_frame_path]}
                alt={`Calibration preview ${fullscreenSlot}`}
                style={frameImageStyle}
              />
              {previewModeBySlot[fullscreenSlot] === "original" && calibrationBySlot[fullscreenSlot]?.chart_detected ? <CalibrationOverlay calibration={calibrationBySlot[fullscreenSlot]} /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildAnalysisModel(
  slot: string,
  result: CameraMatchAnalysisResult,
  heroSlot: string,
  heroResult?: CameraMatchAnalysisResult,
): CameraMatchAnalysis {
  const metrics: CameraMatchMetrics = {
    luma_histogram: result.aggregate.luma_histogram,
    rgb_medians: result.aggregate.rgb_medians,
    luma_median: result.aggregate.luma_median,
    highlight_percent: result.aggregate.highlight_percent,
    midtone_density: result.aggregate.midtone_density,
  };
  if (!heroResult || heroSlot === slot) {
    return {
      slot,
      clip_path: result.clip_path,
      clip_name: result.clip_name,
      representative_frame_path: result.representative_frame_path,
      frame_paths: result.frame_paths,
      per_frame: result.per_frame,
      metrics,
      delta_vs_hero: null,
      suggestions: {
        exposure: "Hero baseline",
        white_balance: "Hero baseline",
        highlight: "Hero baseline",
        confidence: computeConfidence(result.aggregate, result.per_frame.length),
        warning: computeVarianceWarning(result.aggregate, result.per_frame.length),
      },
    };
  }
  const delta = computeDelta(metrics, {
    luma_histogram: heroResult.aggregate.luma_histogram,
    rgb_medians: heroResult.aggregate.rgb_medians,
    luma_median: heroResult.aggregate.luma_median,
    highlight_percent: heroResult.aggregate.highlight_percent,
    midtone_density: heroResult.aggregate.midtone_density,
  });
  return {
    slot,
    clip_path: result.clip_path,
    clip_name: result.clip_name,
    representative_frame_path: result.representative_frame_path,
    frame_paths: result.frame_paths,
    per_frame: result.per_frame,
    metrics,
    delta_vs_hero: delta,
    suggestions: buildSuggestionSet(delta, metrics, {
      luma_histogram: heroResult.aggregate.luma_histogram,
      rgb_medians: heroResult.aggregate.rgb_medians,
      luma_median: heroResult.aggregate.luma_median,
      highlight_percent: heroResult.aggregate.highlight_percent,
      midtone_density: heroResult.aggregate.midtone_density,
    }, result.aggregate, result.per_frame.length),
  };
}

function buildMatchLabGuidance({
  clipsBySlot,
  analysisBySlot,
  calibrationBySlot,
  slotErrors,
  heroSlot,
  analyses,
  analysisOverrideBySlot,
  selectedSlots,
}: {
  clipsBySlot: Record<string, string>;
  analysisBySlot: Record<string, CameraMatchAnalysisResult>;
  calibrationBySlot: Record<string, CalibrationChartDetection>;
  slotErrors: Record<string, string>;
  heroSlot: string;
  analyses: CameraMatchAnalysis[];
  analysisOverrideBySlot: Record<string, string>;
  selectedSlots: string[];
}): { items: MatchLabGuidanceItem[]; action: MatchLabGuidanceAction | null } {
  const items: MatchLabGuidanceItem[] = [];

  for (const slot of SLOT_ORDER) {
    const clipPath = clipsBySlot[slot];
    if (!clipPath) continue;
    if (isProxyOnlyRawClip(clipPath) && !analysisOverrideBySlot[slot]) {
      items.push({
        id: `proxy-${slot}`,
        priority: 1,
        tone: "critical",
        slot,
        label: `Attach MP4/MOV proxy for Camera ${slot}`,
        reason: `${getProxyOnlyFormatBadge(clipPath)} is accepted in Match Lab, but this source analyzes through an operator-selected proxy.`,
      });
    }
  }

  for (const slot of SLOT_ORDER) {
    const slotError = slotErrors[slot] || "";
    if (!slotError) continue;
    if (slotError.toLowerCase().includes("chart not detected")) {
      items.push({
        id: `chart-missing-${slot}`,
        priority: 1,
        tone: "critical",
        slot,
        label: `Reframe chart larger for Camera ${slot}`,
        reason: "The chart was not detected, so the patch geometry is not reliable enough for calibration.",
      });
      items.push({
        id: `chart-angle-${slot}`,
        priority: 1,
        tone: "critical",
        slot,
        label: `Keep the chart flatter to Camera ${slot}`,
        reason: "Reducing angle and perspective distortion gives the detector a cleaner rectangle and more stable patch mapping.",
      });
      items.push({
        id: `chart-retry-${slot}`,
        priority: 2,
        tone: "warning",
        slot,
        label: `Retry calibration before trusting LUT on Camera ${slot}`,
        reason: "Without a detected chart, Match Lab can still show analysis, but calibration and LUT output should not be trusted yet.",
      });
    }
  }

  for (const slot of SLOT_ORDER) {
    const calibration = calibrationBySlot[slot];
    if (!calibration?.chart_detected) continue;
    for (const warning of calibration.warnings) {
      const compact = compactWarningLabel(warning);
      const mapped = mapCalibrationWarningToGuidance(slot, compact, warning);
      if (mapped) {
        items.push(mapped);
      }
    }
    if (calibration.transform_quality_flag) {
      items.push({
        id: `transform-${slot}`,
        priority: 2,
        tone: "warning",
        slot,
        label: `Do not trust Camera ${slot} LUT yet`,
        reason: calibration.transform_quality_flag,
      });
    }
    if (calibration.calibration_quality_level === "Poor") {
      items.push({
        id: `quality-poor-${slot}`,
        priority: 2,
        tone: "critical",
        slot,
        label: `Re-capture the chart for Camera ${slot}`,
        reason: `Calibration quality is ${calibration.calibration_quality_level.toLowerCase()}, so the current transform is weak for on-set use.`,
      });
    }
  }

  for (const analysis of analyses) {
    if (analysis.slot === heroSlot) continue;
    const delta = analysis.delta_vs_hero;
    if (!delta) continue;
    if (analysis.suggestions?.exposure && analysis.suggestions.exposure !== "Hold") {
      items.push({
        id: `exposure-${analysis.slot}`,
        priority: 3,
        tone: "info",
        slot: analysis.slot,
        label: `${analysis.suggestions.exposure} on Camera ${analysis.slot}`,
        reason: `Camera ${analysis.slot} luma is offset from Hero ${heroSlot}, so the measured stop delta should be corrected first.`,
      });
    } else if (Math.abs(delta.luma_median) <= 0.015) {
      items.push({
        id: `close-${analysis.slot}`,
        priority: 3,
        tone: "good",
        slot: analysis.slot,
        label: `Camera ${analysis.slot} is already close to Hero ${heroSlot}`,
        reason: "Measured luma and highlight deltas are already tight, so only small trims should be needed.",
      });
    }
    if (analysis.suggestions?.white_balance && !analysis.suggestions.white_balance.includes("hold")) {
      items.push({
        id: `wb-${analysis.slot}`,
        priority: 3,
        tone: "info",
        slot: analysis.slot,
        label: `Match Camera ${analysis.slot} toward Hero ${heroSlot}`,
        reason: `Measured RGB deltas suggest ${analysis.suggestions.white_balance} before trusting the visual monitor match.`,
      });
    }
  }

  for (const slot of SLOT_ORDER) {
    const analysis = analysisBySlot[slot];
    const calibration = calibrationBySlot[slot];
    if (!analysis) continue;
    if (analysis.original_format_kind === "NIKON_NRAW" && calibration?.lut_path) {
      items.push({
        id: `monitor-lut-${slot}`,
        priority: 4,
        tone: "info",
        slot,
        label: `Use the exported LUT on an external monitor for Camera ${slot}`,
        reason: "This Nikon path is easier to judge with a technical monitor transform than with a plain log preview.",
      });
    }
  }

  const deduped = dedupeGuidanceItems(items).sort((a, b) => a.priority - b.priority);
  const action = pickGuidanceAction(deduped, {
    clipsBySlot,
    selectedSlots,
    analysesCount: analyses.length,
  });
  return { items: deduped, action };
}

function mapCalibrationWarningToGuidance(slot: string, compact: string, fullWarning: string): MatchLabGuidanceItem | null {
  if (compact === "Chart too small") {
    return {
      id: `warn-small-${slot}`,
      priority: 1,
      tone: "critical",
      slot,
      label: `Move chart closer for Camera ${slot}`,
      reason: fullWarning,
    };
  }
  if (compact === "Too much skew") {
    return {
      id: `warn-skew-${slot}`,
      priority: 1,
      tone: "critical",
      slot,
      label: `Reduce chart angle for Camera ${slot}`,
      reason: fullWarning,
    };
  }
  if (compact === "Highlights clipped") {
    return {
      id: `warn-clip-${slot}`,
      priority: 1,
      tone: "critical",
      slot,
      label: `Lower chart exposure on Camera ${slot}`,
      reason: fullWarning,
    };
  }
  if (compact === "Shadows crushed") {
    return {
      id: `warn-crush-${slot}`,
      priority: 1,
      tone: "critical",
      slot,
      label: `Lift shadow exposure on Camera ${slot}`,
      reason: fullWarning,
    };
  }
  if (compact === "Uneven light") {
    return {
      id: `warn-light-${slot}`,
      priority: 1,
      tone: "warning",
      slot,
      label: `Even out chart lighting for Camera ${slot}`,
      reason: fullWarning,
    };
  }
  if (compact === "Weak improvement") {
    return {
      id: `warn-weak-${slot}`,
      priority: 2,
      tone: "warning",
      slot,
      label: `Use Match Lab analysis only for Camera ${slot}`,
      reason: fullWarning,
    };
  }
  if (compact === "Match worse") {
    return {
      id: `warn-worse-${slot}`,
      priority: 2,
      tone: "critical",
      slot,
      label: `Re-capture chart before using Camera ${slot} LUT`,
      reason: fullWarning,
    };
  }
  return null;
}

function dedupeGuidanceItems(items: MatchLabGuidanceItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function pickGuidanceAction(
  items: MatchLabGuidanceItem[],
  context: { clipsBySlot: Record<string, string>; selectedSlots: string[]; analysesCount: number },
): MatchLabGuidanceAction | null {
  const proxyItem = items.find((item) => item.id.startsWith("proxy-") && item.slot);
  if (proxyItem?.slot) {
    return { kind: "proxy", label: "Apply Proxy and Re-run", slot: proxyItem.slot };
  }
  const recalibrateItem = items.find((item) => (
    item.slot
    && (
      item.id.startsWith("chart-")
      || item.id.startsWith("warn-small-")
      || item.id.startsWith("warn-skew-")
      || item.id.startsWith("warn-clip-")
      || item.id.startsWith("warn-crush-")
      || item.id.startsWith("warn-light-")
      || item.id.startsWith("warn-worse-")
      || item.id.startsWith("quality-poor-")
    )
  ));
  if (recalibrateItem?.slot) {
    return { kind: "recalibrate", label: "Retry Calibration", slot: recalibrateItem.slot };
  }
  if (context.analysesCount > 0) {
    return { kind: "export", label: "Export Current Results" };
  }
  if (context.selectedSlots.length > 0) {
    return { kind: "analyze", label: "Analyze Current Clips" };
  }
  return null;
}

function computeDelta(current: CameraMatchMetrics, hero: CameraMatchMetrics): CameraMatchDelta {
  return {
    luma_median: current.luma_median - hero.luma_median,
    highlight_percent: current.highlight_percent - hero.highlight_percent,
    midtone_density: current.midtone_density - hero.midtone_density,
    red_median: current.rgb_medians.red - hero.rgb_medians.red,
    green_median: current.rgb_medians.green - hero.rgb_medians.green,
    blue_median: current.rgb_medians.blue - hero.rgb_medians.blue,
  };
}

function buildSuggestionSet(
  delta: CameraMatchDelta,
  current: CameraMatchMetrics,
  hero: CameraMatchMetrics,
  aggregateVariance: {
    luma_variance: number;
    red_variance: number;
    green_variance: number;
    blue_variance: number;
    highlight_variance: number;
    midtone_variance: number;
  },
  frameCount: number,
): CameraMatchSuggestionSet {
  const safeCurrent = Math.max(current.luma_median, 0.01);
  const safeHero = Math.max(hero.luma_median, 0.01);
  const stopDelta = clamp(Math.log2(safeHero / safeCurrent), -2, 2);
  const boundedStops = Math.abs(stopDelta) < 0.08 ? 0 : roundTo(stopDelta, 0.1);

  const heroRb = hero.rgb_medians.red - hero.rgb_medians.blue;
  const currentRb = current.rgb_medians.red - current.rgb_medians.blue;
  const kelvinShift = clamp(Math.round(((heroRb - currentRb) * 8000) / 100) * 100, -1200, 1200);
  const heroTintBase = hero.rgb_medians.green - (hero.rgb_medians.red + hero.rgb_medians.blue) * 0.5;
  const currentTintBase = current.rgb_medians.green - (current.rgb_medians.red + current.rgb_medians.blue) * 0.5;
  const tintShift = clamp(Math.round((heroTintBase - currentTintBase) * 180), -10, 10);

  return {
    exposure: boundedStops === 0 ? "Hold" : `${boundedStops > 0 ? "+" : ""}${boundedStops.toFixed(1)} stop`,
    white_balance: `${formatKelvinShift(kelvinShift)} • ${formatTintShift(tintShift)}`,
    highlight: delta.highlight_percent > 0.015
      ? `Warn +${(delta.highlight_percent * 100).toFixed(1)}%`
      : delta.highlight_percent < -0.015
        ? `Safer ${(Math.abs(delta.highlight_percent) * 100).toFixed(1)}%`
        : "Aligned",
    confidence: computeConfidence(aggregateVariance, frameCount),
    warning: computeVarianceWarning(aggregateVariance, frameCount),
  };
}

function computeConfidence(
  aggregateVariance: {
    luma_variance: number;
    red_variance: number;
    green_variance: number;
    blue_variance: number;
    highlight_variance: number;
    midtone_variance: number;
  },
  frameCount: number,
): "High" | "Medium" | "Low" {
  if (frameCount < 5) return "Low";
  const varianceScore = aggregateVariance.luma_variance
    + aggregateVariance.highlight_variance
    + aggregateVariance.midtone_variance
    + ((aggregateVariance.red_variance + aggregateVariance.green_variance + aggregateVariance.blue_variance) / 3);
  if (varianceScore <= 0.002) return "High";
  if (varianceScore <= 0.008) return "Medium";
  return "Low";
}

function computeVarianceWarning(
  aggregateVariance: {
    luma_variance: number;
    red_variance: number;
    green_variance: number;
    blue_variance: number;
    highlight_variance: number;
    midtone_variance: number;
  },
  frameCount: number,
) {
  if (frameCount < 5) {
    return "Partial sample. Add a full 5-frame clip for stronger matching confidence.";
  }
  const varianceScore = aggregateVariance.luma_variance
    + aggregateVariance.highlight_variance
    + aggregateVariance.midtone_variance;
  if (varianceScore > 0.008) {
    return "Lighting changed across frames — capture a new reference clip.";
  }
  return null;
}

function HistogramOverlay({ histogram }: { histogram: number[] }) {
  const max = Math.max(...histogram, 1);
  const points = histogram.map((value, index) => {
    const x = (index / Math.max(histogram.length - 1, 1)) * 100;
    const y = 100 - (value / max) * 100;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <rect x="0" y="0" width="100" height="100" fill="rgba(9,11,14,0.68)" />
      <polyline fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" points={points} />
      <line x1="40" y1="0" x2="40" y2="100" stroke="rgba(88,166,255,0.55)" strokeWidth="0.8" strokeDasharray="3 3" />
      <line x1="70" y1="0" x2="70" y2="100" stroke="rgba(255,194,95,0.55)" strokeWidth="0.8" strokeDasharray="3 3" />
      <line x1="95" y1="0" x2="95" y2="100" stroke="rgba(255,95,68,0.7)" strokeWidth="0.8" strokeDasharray="3 3" />
    </svg>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={chipStyle}>
      <div style={chipLabelStyle}>{label}</div>
      <div style={chipValueStyle}>{value}</div>
    </div>
  );
}

function DeltaChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={deltaChipStyle}>
      <div style={chipLabelStyle}>{label}</div>
      <div style={chipValueStyle}>{value}</div>
    </div>
  );
}

function SuggestionChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={suggestionChipStyle}>
      <div style={chipLabelStyle}>{label}</div>
      <div style={chipValueStyle}>{value}</div>
    </div>
  );
}

function CalibrationOverlay({ calibration }: { calibration: CalibrationChartDetection }) {
  const polygon = calibration.chart_corners
    .map((corner) => `${corner.x * 100},${corner.y * 100}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={calibrationOverlaySvgStyle}>
      <polygon points={polygon} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="0.45" />
      {calibration.patch_samples.map((patch) => (
        <circle
          key={patch.patch_index}
          cx={patch.center_x * 100}
          cy={patch.center_y * 100}
          r="0.9"
          fill={deltaEColor(patch.delta_e)}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="0.22"
        />
      ))}
    </svg>
  );
}

function PatchDeltaSwatch({ patch }: { patch: CalibrationChartDetection["patch_samples"][number] }) {
  return (
    <div style={patchSwatchStyle}>
      <div style={{ ...patchColorStyle, background: rgbCss(patch.reference_rgb) }} />
      <div style={{ ...patchColorStyle, background: rgbCss(patch.measured_rgb_mean) }} />
      <div style={{ ...patchDeltaStyle, color: deltaEColor(patch.delta_e) }}>{patch.delta_e.toFixed(1)}</div>
    </div>
  );
}

function buildCalibrationDisplay(
  calibration: CalibrationChartDetection,
  heroCalibration: CalibrationChartDetection | undefined,
  isHero: boolean,
) {
  if (isHero || !heroCalibration) {
    return {
      exposure: "Baseline",
      whiteBalance: "Baseline",
      tint: "Baseline",
    };
  }
  const exposure = clamp(calibration.exposure_offset_stops - heroCalibration.exposure_offset_stops, -2, 2);
  const wbShift = calibration.wb_kelvin_shift - heroCalibration.wb_kelvin_shift;
  const tintShift = calibration.tint_shift - heroCalibration.tint_shift;
  return {
    exposure: formatExposureShift(exposure),
    whiteBalance: formatKelvinShift(wbShift),
    tint: formatTintDelta(tintShift),
  };
}

function getFileName(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

function isBrawClip(path: string) {
  return path.toLowerCase().endsWith(".braw");
}

function isNrawClip(path: string) {
  return path.toLowerCase().endsWith(".nev");
}

function isR3dClip(path: string) {
  return path.toLowerCase().endsWith(".r3d");
}

function isProxyOnlyRawClip(path: string) {
  return isNrawClip(path) || isR3dClip(path);
}

function getProxyOnlyFormatBadge(path: string) {
  if (isNrawClip(path)) return "N-RAW";
  if (isR3dClip(path)) return "R3D";
  return "RAW";
}

function formatRunTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseStructuredError(message: string) {
  const summaryMatch = message.match(/^Summary:\s*(.+)$/m);
  const detailsMatch = message.match(/^Details:\n([\s\S]+)$/m);
  return {
    summary: summaryMatch?.[1]?.trim() ?? "",
    details: detailsMatch?.[1]?.trim() ?? "",
  };
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatRgbTriplet(rgb: { red: number; green: number; blue: number }) {
  return `${Math.round(rgb.red * 255)} / ${Math.round(rgb.green * 255)} / ${Math.round(rgb.blue * 255)}`;
}

function formatKelvinShift(value: number) {
  if (value === 0) return "WB hold";
  return `${value > 0 ? "+" : ""}${value}K`;
}

function formatTintShift(value: number) {
  if (value === 0) return "Tint hold";
  if (value > 0) return `Tint +${value}G`;
  return `Tint ${value}M`;
}

function formatExposureShift(value: number) {
  if (Math.abs(value) < 0.05) return "Hold";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} stop`;
}

function formatTintDelta(value: number) {
  if (value === 0) return "Tint hold";
  if (value > 0) return `+${value}G`;
  return `${value}M`;
}

function formatImprovement(before: number, after?: number | null) {
  if (after == null || before <= 0 || after >= before) return "—";
  return `${Math.round(((before - after) / before) * 100)}%`;
}

function compactWarningLabel(warning: string) {
  if (warning.startsWith("Chart too small")) return "Chart too small";
  if (warning.startsWith("Chart angle")) return "Too much skew";
  if (warning.startsWith("Highlights clipped")) return "Highlights clipped";
  if (warning.startsWith("Shadows crushed")) return "Shadows crushed";
  if (warning.startsWith("Uneven lighting")) return "Uneven light";
  if (warning.startsWith("Calibration produced weak")) return "Weak improvement";
  if (warning.startsWith("Calibration made the match worse")) return "Match worse";
  return warning;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgbCss(rgb: [number, number, number]) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function deltaEColor(delta: number) {
  if (delta <= 4) return "rgba(34,197,94,0.9)";
  if (delta <= 9) return "rgba(245,158,11,0.9)";
  return "rgba(239,68,68,0.9)";
}

function qualityLevelStyle(level: string): React.CSSProperties {
  if (level === "Good") return { color: "rgba(110,231,183,0.98)", borderColor: "rgba(34,197,94,0.32)" };
  if (level === "Caution") return { color: "rgba(251,191,36,0.96)", borderColor: "rgba(245,158,11,0.28)" };
  return { color: "rgba(248,113,113,0.96)", borderColor: "rgba(239,68,68,0.3)" };
}

function qualityLevelFillStyle(level: string): React.CSSProperties {
  if (level === "Good") return { background: "linear-gradient(90deg, rgba(22,163,74,0.9), rgba(74,222,128,0.88))" };
  if (level === "Caution") return { background: "linear-gradient(90deg, rgba(217,119,6,0.92), rgba(251,191,36,0.88))" };
  return { background: "linear-gradient(90deg, rgba(220,38,38,0.92), rgba(248,113,113,0.88))" };
}

function guidanceToneDotColor(tone: MatchLabGuidanceItem["tone"]): React.CSSProperties {
  if (tone === "critical") return { background: "var(--status-orange)" };
  if (tone === "warning") return { background: "var(--text-muted)" };
  if (tone === "good") return { background: "var(--status-green)" };
  return { background: "var(--color-accent)" };
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function slotBadgeColor(slot: string): React.CSSProperties {
  if (slot === "A") return { background: "rgba(59,130,246,0.14)", color: "#93c5fd" };
  if (slot === "B") return { background: "rgba(34,197,94,0.14)", color: "#86efac" };
  return { background: "rgba(245,158,11,0.14)", color: "#fcd34d" };
}

const headerRowStyle: React.CSSProperties = { display: "grid", gap: 14, marginBottom: 20 };
const headerTitleRowStyle: React.CSSProperties = { display: "grid", gap: 4, minWidth: 0 };
const headerTitleStyle: React.CSSProperties = { color: "var(--text-primary)", fontSize: "1.28rem", fontWeight: 700, letterSpacing: "0.01em" };
const headerUtilityRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", flexWrap: "wrap", minWidth: 0 };
const headerMetaClusterStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 24, minWidth: 0, flexWrap: "wrap", flex: "1 1 auto" };
const headerCapsuleStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", minHeight: 44, maxWidth: "100%", flexWrap: "nowrap", minWidth: 0 };
const capsuleDividerStyle: React.CSSProperties = { width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.08)" };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center", flexWrap: "nowrap", justifyContent: "flex-end", minWidth: 0 };
const headerInfoBlockStyle: React.CSSProperties = { display: "grid", gap: 2, minWidth: 0 };
const headerProjectNameStyle: React.CSSProperties = { color: "var(--text-primary)", fontSize: "0.96rem", fontWeight: 700, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const headerControlGroupStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, minHeight: 32 };
const headerControlLabelStyle: React.CSSProperties = { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800, color: "var(--text-muted)" };
const heroInlineStyle: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "nowrap" };
const runChipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, maxWidth: 240, whiteSpace: "nowrap", minWidth: 0, borderRadius: 12 };
const runChipLabelStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 700 };
const runChipValueStyle: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const matchLabLayoutStyle: React.CSSProperties = { display: "block" };
const runsPopoverStyle: React.CSSProperties = { position: "absolute", top: "calc(100% + 8px)", right: 0, width: 280, maxHeight: 280, overflowY: "auto", padding: 8, borderRadius: 12, background: "#0c0d0f", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 18px 40px rgba(0,0,0,0.4)", zIndex: 30, display: "grid", gap: 6 };
const runsEmptyStyle: React.CSSProperties = { padding: "10px 8px", color: "var(--text-muted)", borderRadius: 12, background: "rgba(255,255,255,0.02)", textAlign: "center", whiteSpace: "nowrap" };
const runItemStyle: React.CSSProperties = { padding: "8px 8px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", textAlign: "left", display: "flex", alignItems: "center", gap: 8, minHeight: 46 };
const runItemActiveStyle: React.CSSProperties = { border: "1px solid rgba(88,166,255,0.35)", background: "rgba(88,166,255,0.08)" };
const runSelectButtonStyle: React.CSSProperties = { border: "none", background: "transparent", color: "inherit", padding: 0, textAlign: "left", cursor: "pointer", width: "100%", minWidth: 0 };
const runDeleteButtonStyle: React.CSSProperties = { border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", width: 30, height: 30, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "opacity 120ms ease" };
const runItemTitleStyle: React.CSSProperties = { fontSize: "0.88rem", fontWeight: 700 };
const runItemMetaStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--text-muted)" };
const modalBackdropStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(5,6,8,0.68)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 80 };
const modalCardStyle: React.CSSProperties = { width: "min(420px, 100%)", padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "#0c0d10", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" };
const modalTitleStyle: React.CSSProperties = { fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 };
const modalBodyStyle: React.CSSProperties = { color: "var(--text-secondary)", lineHeight: 1.5 };
const modalMetaStyle: React.CSSProperties = { marginTop: 10, color: "var(--text-muted)", fontSize: "0.82rem" };
const modalActionsStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 };
const subtleStyle: React.CSSProperties = { margin: 0, color: "var(--text-muted)", maxWidth: 760, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" };
const errorCardStyle: React.CSSProperties = { marginBottom: 16, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.08)", color: "#fecaca" };
const errorActionsStyle: React.CSSProperties = { marginTop: 10 };
const errorDetailsStyle: React.CSSProperties = { marginTop: 10 };
const errorDetailsSummaryStyle: React.CSSProperties = { cursor: "pointer", color: "#fecaca", fontSize: "0.8rem", fontWeight: 700 };
const errorDetailsBodyStyle: React.CSSProperties = { margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.76rem", lineHeight: 1.45, color: "#fca5a5" };
const gridStyle: React.CSSProperties = { minWidth: 0 };
const cameraColumnStyle: React.CSSProperties = { minWidth: 0 };
const cameraCardStyle: React.CSSProperties = { padding: 16, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)", minWidth: 0 };
const slotHeaderRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 };
const slotBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" };
const heroChipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "5px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "var(--text-primary)", fontSize: "0.72rem", fontWeight: 700 };
const cameraActionsWrapStyle: React.CSSProperties = { display: "grid", gap: 8, marginBottom: 12, minWidth: 0 };
const cameraActionsTopRowStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap", minHeight: 34, minWidth: 0 };
const cameraActionsSupportRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", minHeight: 34, minWidth: 0 };
const actionPlaceholderStyle: React.CSSProperties = { display: "inline-flex", minWidth: 92, height: 34, visibility: "hidden", flexShrink: 0 };
const supportRowPlaceholderStyle: React.CSSProperties = { display: "block", width: 1, height: 34, visibility: "hidden" };
const fileMetaStyle: React.CSSProperties = { fontSize: "0.94rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const helperMetaStyle: React.CSSProperties = { color: "var(--text-muted)", lineHeight: 1.45, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const sourceMetaRowStyle: React.CSSProperties = { marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const sourceBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "var(--text-primary)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em" };
const sourceMetaTextStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "0.74rem", fontWeight: 700 };
const sourceMetaInlineStyle: React.CSSProperties = { marginTop: 8, color: "var(--text-secondary)", fontSize: "0.74rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const statusMetaStyle: React.CSSProperties = { marginTop: 10, fontSize: "0.78rem", color: "#93c5fd" };
const analysisCardStyle: React.CSSProperties = { padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(9,10,13,0.78)", minHeight: 420, display: "flex", flexDirection: "column", minWidth: 0 };
const frameWrapStyle: React.CSSProperties = { position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#080a0c", aspectRatio: "16 / 9", marginBottom: 12 };
const frameImageStyle: React.CSSProperties = { width: "100%", height: "100%", display: "block", objectFit: "cover" };
const frameOverlayStyle: React.CSSProperties = { position: "absolute", left: 10, right: 10, bottom: 10, height: 88, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" };
const frameExpandButtonStyle: React.CSSProperties = { position: "absolute", top: 10, right: 10, minWidth: 36, minHeight: 36, borderRadius: 10, background: "rgba(5,8,12,0.58)" };
const calibrationOverlaySvgStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };
const calibrationStripStyle: React.CSSProperties = { display: "grid", gap: 8, marginBottom: 10 };
const calibrationHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 };
const calibrationHeaderMetaStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap", justifyContent: "flex-end" };
const qualitySummaryStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "0.74rem", fontWeight: 700 };
const qualityLevelChipStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.04em", background: "rgba(255,255,255,0.03)" };
const qualityBandStyle: React.CSSProperties = { width: "100%", height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" };
const qualityFillStyle: React.CSSProperties = { height: "100%", borderRadius: 999 };
const warningBadgeRowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const warningBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(245,158,11,0.18)", background: "rgba(245,158,11,0.08)", color: "rgba(251,191,36,0.94)", fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" };
const patchGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 6 };
const patchSwatchStyle: React.CSSProperties = { display: "grid", gap: 4, padding: 6, borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" };
const patchColorStyle: React.CSSProperties = { width: "100%", height: 12, borderRadius: 6 };
const patchDeltaStyle: React.CSSProperties = { fontSize: "0.68rem", color: "var(--text-secondary)", textAlign: "center", fontWeight: 700 };
const previewToggleRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" };
const previewToggleLabelStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "0.74rem", fontWeight: 700, marginLeft: "auto" };
const fullscreenCardStyle: React.CSSProperties = { width: "min(1180px, 100%)", padding: 20, borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", background: "#090b0e", boxShadow: "0 24px 60px rgba(0,0,0,0.45)", display: "grid", gap: 16 };
const fullscreenHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 };
const fullscreenFrameWrapStyle: React.CSSProperties = { position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#07090c" };
const inlineWarningStyle: React.CSSProperties = { marginBottom: 10, color: "rgba(251,191,36,0.94)", fontSize: "0.78rem" };
const metricsWrapStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 };
const deltaRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 };
const chipStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)", flex: "1 1 120px", minWidth: 0 };
const deltaChipStyle: React.CSSProperties = { ...chipStyle, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" };
const suggestionChipStyle: React.CSSProperties = { ...chipStyle, background: "rgba(255,255,255,0.035)" };
const chipLabelStyle: React.CSSProperties = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 5 };
const chipValueStyle: React.CSSProperties = { fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" };
const detailsWrapStyle: React.CSSProperties = { marginTop: 4 };
const detailsSummaryStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", listStyle: "none", color: "var(--text-secondary)", fontSize: "0.84rem", fontWeight: 700 };
const detailsMetaLineStyle: React.CSSProperties = { marginTop: 10, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minWidth: 0 };
const detailsMetaValueStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "0.74rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, textAlign: "right" };
const framesGridStyle: React.CSSProperties = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 };
const frameThumbButtonStyle: React.CSSProperties = { padding: 0, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden", background: "#070809", cursor: "pointer" };
const frameThumbStyle: React.CSSProperties = { display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" };
const frameThumbPlaceholderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "16 / 9", color: "var(--text-muted)", fontSize: "0.72rem" };
const detailsDrawerStyle: React.CSSProperties = { marginTop: 12 };
const rawMetricsGridStyle: React.CSSProperties = { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 };
const rawMetricsCardStyle: React.CSSProperties = { padding: "12px 13px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)", display: "grid", gap: 8 };
const rawMetricsTitleStyle: React.CSSProperties = { fontSize: "0.56rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-accent)", marginBottom: 2, fontWeight: 800 };
const rawMetricsLineStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "var(--text-secondary)", fontSize: "0.64rem", lineHeight: 1.2, whiteSpace: "nowrap" };
const rawMetricsLabelStyle: React.CSSProperties = { color: "var(--text-muted)", fontWeight: 700, flexShrink: 0, fontSize: "0.6rem" };
const rawMetricsValueStyle: React.CSSProperties = { color: "var(--text-primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", fontSize: "0.64rem" };
const placeholderStyle: React.CSSProperties = { minHeight: 320, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 12, color: "var(--text-muted)", textAlign: "center", padding: 24 };
const guidanceSectionStyle: React.CSSProperties = { marginTop: 16, display: "grid", gap: 10, padding: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.022)" };
const guidanceHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const guidanceTitleStyle: React.CSSProperties = { fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 800, color: "var(--text-muted)" };
const guidanceListStyle: React.CSSProperties = { display: "grid", gap: 8 };
const guidanceRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" };
const guidanceRowMainStyle: React.CSSProperties = { minWidth: 0, flex: 1, display: "grid", gap: 4 };
const guidanceRowTopStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, minWidth: 0 };
const guidanceToneDotStyle: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, flexShrink: 0 };
const guidanceLabelStyle: React.CSSProperties = { color: "var(--text-primary)", fontSize: "0.84rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const guidanceHelpStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", color: "var(--text-muted)", cursor: "help", flexShrink: 0 };
const guidanceMoreStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.76rem", fontWeight: 700, padding: "2px 4px" };
const guidanceActionRowStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", marginTop: 2 };
const exportMenuStyle: React.CSSProperties = { position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 244, padding: 8, borderRadius: 12, background: "#0c0d0f", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 18px 40px rgba(0,0,0,0.4)", zIndex: 30, display: "grid", gap: 6 };
const exportItemStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left", whiteSpace: "nowrap" };
