import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import Hls from "hls.js";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Edit3,
  Film,
  FolderUp,
  KeyRound,
  Link2,
  LoaderCircle,
  MousePointer2,
  PenTool,
  PlayCircle,
  RectangleHorizontal,
  Save as SaveIcon,
  ShieldCheck,
  Trash2,
  Type,
} from "lucide-react";
import {
  ReviewCoreAnnotation,
  ReviewCoreApprovalState,
  ReviewCoreAsset,
  ReviewCoreAssetVersion,
  ReviewCoreComment,
  ReviewCoreDuplicateCandidate,
  ReviewCoreShareLinkResolved,
  ReviewCoreShareLinkSummary,
  ReviewCoreShareUnlockResult,
  ReviewCoreSharedAssetSummary,
  ReviewCoreSharedVersionSummary,
  ReviewCoreThumbnailInfo,
} from "../types";

interface ReviewCoreProps {
  projectId?: string | null;
  projectName?: string | null;
  shareToken?: string | null;
  restricted?: boolean;
  onError?: (error: { title: string; hint: string } | null) => void;
  onExitShare?: () => void;
}

type ApprovalStatus = "draft" | "in_review" | "approved" | "rejected";
type AnnotationTool = "pointer" | "pen" | "arrow" | "rect" | "circle" | "text";
type NormalizedPoint = [number, number];
type CommonAsset = ReviewCoreAsset | ReviewCoreSharedAssetSummary;
type CommonVersion = ReviewCoreAssetVersion | ReviewCoreSharedVersionSummary;

interface AnnotationStyle {
  stroke: string;
  width: number;
}

interface ArrowItem {
  id: string;
  type: "arrow";
  a: NormalizedPoint;
  b: NormalizedPoint;
  style: AnnotationStyle;
}

interface RectItem {
  id: string;
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  style: AnnotationStyle;
}

interface CircleItem {
  id: string;
  type: "circle";
  x: number;
  y: number;
  w: number;
  h: number;
  style: AnnotationStyle;
}

interface PenItem {
  id: string;
  type: "pen";
  points: NormalizedPoint[];
  style: AnnotationStyle;
}

interface TextItem {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  style: AnnotationStyle;
}

type AnnotationItem = ArrowItem | RectItem | CircleItem | PenItem | TextItem;

interface AnnotationVectorData {
  schemaVersion: 1;
  commentId: string;
  timestampMs: number;
  items: AnnotationItem[];
}

interface OverlayFrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  stroke: "#00d1ff",
  width: 2,
};

const DEFAULT_APPROVAL: ReviewCoreApprovalState = {
  asset_version_id: "",
  status: "draft",
  approved_at: null,
  approved_by: null,
};

export function ReviewCore({
  projectId,
  projectName,
  shareToken,
  restricted = false,
  onError,
  onExitShare,
}: ReviewCoreProps) {
  const isShareMode = Boolean(shareToken);
  const effectiveProjectId = projectId ?? null;

  const [assets, setAssets] = useState<CommonAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [versions, setVersions] = useState<CommonVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [serverBaseUrl, setServerBaseUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [thumbnails, setThumbnails] = useState<ReviewCoreThumbnailInfo[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [pendingDuplicateFiles, setPendingDuplicateFiles] = useState<string[] | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<ReviewCoreDuplicateCandidate[]>([]);
  const [comments, setComments] = useState<ReviewCoreComment[]>([]);
  const [annotations, setAnnotations] = useState<ReviewCoreAnnotation[]>([]);
  const [approval, setApproval] = useState<ReviewCoreApprovalState>(DEFAULT_APPROVAL);
  const [approvalName, setApprovalName] = useState("Anonymous");
  const [savingApproval, setSavingApproval] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("Anonymous");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [annotatingCommentId, setAnnotatingCommentId] = useState<string | null>(null);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("pointer");
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationVectorData | null>(null);
  const [annotationTextValue, setAnnotationTextValue] = useState("Note");
  const [selectedAnnotationItemId, setSelectedAnnotationItemId] = useState<string | null>(null);
  const [activeDraftItem, setActiveDraftItem] = useState<AnnotationItem | null>(null);
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [frameRect, setFrameRect] = useState<OverlayFrameRect>({ left: 0, top: 0, width: 0, height: 0 });

  const [shareLinks, setShareLinks] = useState<ReviewCoreShareLinkSummary[]>([]);
  const [shareVersionIds, setShareVersionIds] = useState<string[]>([]);
  const [shareAllowComments, setShareAllowComments] = useState(true);
  const [shareAllowDownload, setShareAllowDownload] = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiryLocal, setShareExpiryLocal] = useState("");
  const [creatingShareLink, setCreatingShareLink] = useState(false);
  const [copiedShareLinkId, setCopiedShareLinkId] = useState<string | null>(null);
  const [shareResolved, setShareResolved] = useState<ReviewCoreShareLinkResolved | null>(null);
  const [sharePasswordInput, setSharePasswordInput] = useState("");
  const [shareUnlocked, setShareUnlocked] = useState(!isShareMode);
  const [shareSessionToken, setShareSessionToken] = useState<string | null>(null);
  const [verifyingSharePassword, setVerifyingSharePassword] = useState(false);
  const [sharePasswordError, setSharePasswordError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerFrameRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const dragStateRef = useRef<{ mode: "draw" | "move"; start: NormalizedPoint; itemId?: string } | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || null,
    [versions, selectedVersionId]
  );
  const annotationsByCommentId = useMemo(() => {
    const map = new Map<string, ReviewCoreAnnotation>();
    for (const annotation of annotations) map.set(annotation.comment_id, annotation);
    return map;
  }, [annotations]);
  const activeViewAnnotation = useMemo(() => {
    if (annotatingCommentId) return null;
    const activeComment = comments.find(
      (comment) => Math.abs(comment.timestamp_ms - currentTime * 1000) <= 250 && annotationsByCommentId.has(comment.id)
    );
    return activeComment ? annotationsByCommentId.get(activeComment.id) || null : null;
  }, [annotatingCommentId, annotationsByCommentId, comments, currentTime]);
  const parsedActiveAnnotation = useMemo(
    () => parseAnnotationData(activeViewAnnotation?.vector_data, activeViewAnnotation?.comment_id, activeViewAnnotation?.timestamp_ms),
    [activeViewAnnotation]
  );
  const activeEditingComment = useMemo(
    () => comments.find((comment) => comment.id === annotatingCommentId) || null,
    [annotatingCommentId, comments]
  );
  const canShowComments = !isShareMode || Boolean(shareResolved?.allow_comments);
  const canAddComments = !isShareMode || Boolean(shareResolved?.allow_comments);
  const displayProjectName = isShareMode ? shareResolved?.project_name || "Shared Review" : projectName || "Current Workspace";

  useEffect(() => {
    invoke<string>("review_core_get_server_base_url")
      .then(setServerBaseUrl)
      .catch((error) => {
        console.error("Failed loading Review Core server URL", error);
      });
  }, []);

  useEffect(() => {
    if (!isShareMode || !shareToken) {
      setShareResolved(null);
      setShareUnlocked(true);
      setShareSessionToken(null);
      return;
    }
    invoke<ReviewCoreShareLinkResolved>("review_core_resolve_share_link", { token: shareToken })
      .then((resolved) => {
        setShareResolved(resolved);
        setShareUnlocked(!resolved.password_required);
        setShareSessionToken(null);
        setSharePasswordError(null);
        onError?.(null);
      })
      .catch((error) => {
        const hint = String(error);
        setShareResolved(null);
        setShareUnlocked(false);
        onError?.({
          title: hint.includes("EXPIRED") ? "Share link expired" : "Share link unavailable",
          hint,
        });
      });
  }, [isShareMode, shareToken, onError]);

  const refreshAssets = async () => {
    if (isShareMode) {
      if (!shareToken || !shareUnlocked) {
        setAssets([]);
        return;
      }
    } else if (!effectiveProjectId) {
      setAssets([]);
      return;
    }

    setLoading(true);
    try {
      const nextAssets = isShareMode
        ? await invoke<ReviewCoreSharedAssetSummary[]>("review_core_share_list_assets", {
            token: shareToken,
            sessionToken: shareSessionToken,
          })
        : await invoke<ReviewCoreAsset[]>("review_core_list_assets", { projectId: effectiveProjectId });
      setAssets(nextAssets);
      setSelectedAssetId((current) =>
        current && nextAssets.some((asset) => asset.id === current) ? current : nextAssets[0]?.id ?? null
      );
      onError?.(null);
    } catch (error) {
      console.error("Failed loading Review Core assets", error);
      onError?.({ title: "Review Core failed to load", hint: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const refreshVersions = async (assetId: string) => {
    try {
      const nextVersions = isShareMode
        ? await invoke<ReviewCoreSharedVersionSummary[]>("review_core_share_list_versions", {
            token: shareToken,
            assetId,
            sessionToken: shareSessionToken,
          })
        : await invoke<ReviewCoreAssetVersion[]>("review_core_list_asset_versions", { assetId });
      setVersions(nextVersions);
      setSelectedVersionId((current) =>
        current && nextVersions.some((version) => version.id === current) ? current : nextVersions[0]?.id ?? null
      );
    } catch (error) {
      console.error("Failed loading Review Core versions", error);
      onError?.({ title: "Review Core versions failed", hint: String(error) });
    }
  };

  const refreshShareLinks = async () => {
    if (isShareMode || !effectiveProjectId) {
      setShareLinks([]);
      return;
    }
    try {
      const nextLinks = await invoke<ReviewCoreShareLinkSummary[]>("review_core_list_share_links", {
        projectId: effectiveProjectId,
      });
      setShareLinks(nextLinks);
    } catch (error) {
      console.error("Failed loading Review Core share links", error);
    }
  };

  useEffect(() => {
    refreshAssets();
  }, [effectiveProjectId, isShareMode, shareToken, shareUnlocked, shareSessionToken]);

  useEffect(() => {
    refreshShareLinks();
  }, [effectiveProjectId, isShareMode]);

  useEffect(() => {
    if (!selectedAssetId) {
      setVersions([]);
      setSelectedVersionId(null);
      setThumbnails([]);
      setComments([]);
      setAnnotations([]);
      setApproval(DEFAULT_APPROVAL);
      return;
    }
    refreshVersions(selectedAssetId);
  }, [selectedAssetId, isShareMode, shareToken, shareSessionToken]);

  useEffect(() => {
    if (!selectedVersionId) {
      setThumbnails([]);
      setComments([]);
      setAnnotations([]);
      setApproval(DEFAULT_APPROVAL);
      setAnnotatingCommentId(null);
      return;
    }

    if (!isShareMode) {
      setShareVersionIds([selectedVersionId]);
    }

    const loadVersionData = async () => {
      try {
        const [nextThumbs, nextComments, nextAnnotations, nextApproval] = await Promise.all([
          isShareMode
            ? invoke<ReviewCoreThumbnailInfo[]>("review_core_share_list_thumbnails", {
                token: shareToken,
                assetVersionId: selectedVersionId,
                sessionToken: shareSessionToken,
              })
            : invoke<ReviewCoreThumbnailInfo[]>("review_core_list_thumbnails", { versionId: selectedVersionId }),
          canShowComments
            ? isShareMode
              ? invoke<ReviewCoreComment[]>("review_core_share_list_comments", {
                  token: shareToken,
                  assetVersionId: selectedVersionId,
                  sessionToken: shareSessionToken,
                })
              : invoke<ReviewCoreComment[]>("review_core_list_comments", { assetVersionId: selectedVersionId })
            : Promise.resolve([]),
          isShareMode
            ? invoke<ReviewCoreAnnotation[]>("review_core_share_list_annotations", {
                token: shareToken,
                assetVersionId: selectedVersionId,
                sessionToken: shareSessionToken,
              })
            : invoke<ReviewCoreAnnotation[]>("review_core_list_annotations", { assetVersionId: selectedVersionId }),
          isShareMode
            ? Promise.resolve(DEFAULT_APPROVAL)
            : invoke<ReviewCoreApprovalState>("review_core_get_approval", { assetVersionId: selectedVersionId }).catch(
                () => ({ ...DEFAULT_APPROVAL, asset_version_id: selectedVersionId })
              ),
        ]);
        setThumbnails(nextThumbs);
        setComments(nextComments);
        setAnnotations(nextAnnotations);
        setApproval(nextApproval);
        setApprovalName(nextApproval.approved_by || "Anonymous");
        setAnnotatingCommentId(null);
        setAnnotationDraft(null);
        setSelectedAnnotationItemId(null);
        setActiveDraftItem(null);
      } catch (error) {
        console.error("Failed loading Review Core version data", error);
        onError?.({ title: "Review Core version data failed", hint: String(error) });
      }
    };

    loadVersionData();
  }, [selectedVersionId, isShareMode, shareToken, shareSessionToken, canShowComments]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedAsset || !selectedVersion || !serverBaseUrl) return;

    const queryParts: string[] = [];
    if (isShareMode && shareToken) queryParts.push(`t=${encodeURIComponent(shareToken)}`);
    if (isShareMode && shareSessionToken) queryParts.push(`s=${encodeURIComponent(shareSessionToken)}`);
    const tokenQuery = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    const playlistUrl = `${serverBaseUrl}/media/${selectedAsset.project_id}/${selectedAsset.id}/${selectedVersion.id}/hls/index.m3u8${tokenQuery}`;
    const posterUrl = `${serverBaseUrl}/media/${selectedAsset.project_id}/${selectedAsset.id}/${selectedVersion.id}/poster.jpg${tokenQuery}`;
    video.poster = selectedVersion.processing_status === "ready" ? posterUrl : "";
    video.pause();
    video.removeAttribute("src");
    video.load();
    setCurrentTime(0);
    setDuration(selectedAsset.duration_ms ? selectedAsset.duration_ms / 1000 : 0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (selectedVersion.processing_status !== "ready") {
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playlistUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedAsset, selectedVersion, serverBaseUrl, isShareMode, shareToken, shareSessionToken]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      updateFrameRect();
    };
    const handleCanPlay = () => {
      if (pendingSeekSecondsRef.current != null) {
        video.currentTime = pendingSeekSecondsRef.current;
        pendingSeekSecondsRef.current = null;
      }
      updateFrameRect();
    };
    const handleError = () => {
      if (video.poster) {
        video.poster = "";
      }
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [selectedAsset]);

  useEffect(() => {
    const frame = playerFrameRef.current;
    if (!frame) return;
    const resizeObserver = new ResizeObserver(() => updateFrameRect());
    resizeObserver.observe(frame);
    const video = videoRef.current;
    if (video) resizeObserver.observe(video);
    window.addEventListener("resize", updateFrameRect);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFrameRect);
    };
  }, [selectedAsset, selectedVersion]);

  const updateFrameRect = () => {
    const container = playerFrameRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
    setFrameRect(getVideoFrameRect(container, video));
  };

  const handleImport = async () => {
    if (isShareMode) return;
    const selected = await open({
      multiple: true,
      directory: false,
      title: "Import media into Review Core",
    });
    if (!selected || !effectiveProjectId) return;

    const filePaths = Array.isArray(selected) ? selected : [selected];
    if (filePaths.length === 0) return;

    try {
      const duplicateCheck = await invoke<{ duplicates: ReviewCoreDuplicateCandidate[] }>("review_core_check_duplicate_files", {
        projectId: effectiveProjectId,
        filePaths,
      });
      if (duplicateCheck.duplicates.length > 0) {
        setPendingDuplicateFiles(filePaths);
        setDuplicateCandidates(duplicateCheck.duplicates);
        return;
      }
      await runIngest(filePaths, "new_version");
    } catch (error) {
      console.error("Review Core duplicate check failed", error);
      onError?.({ title: "Review Core ingest failed", hint: String(error) });
    }
  };

  const runIngest = async (filePaths: string[], duplicateMode: "new_version" | "new_asset") => {
    if (!effectiveProjectId) return;
    setImporting(true);
    try {
      await invoke("review_core_ingest_files", { projectId: effectiveProjectId, filePaths, duplicateMode });
      setPendingDuplicateFiles(null);
      setDuplicateCandidates([]);
      await refreshAssets();
    } catch (error) {
      console.error("Review Core ingest failed", error);
      onError?.({ title: "Review Core ingest failed", hint: String(error) });
    } finally {
      setImporting(false);
    }
  };

  const handleThumbnailSeek = (seconds: number) => {
    const video = videoRef.current;
    pendingSeekSecondsRef.current = seconds;
    if (!video || selectedVersion?.processing_status !== "ready") return;
    if (video.readyState >= 1) {
      video.currentTime = seconds;
      pendingSeekSecondsRef.current = null;
    }
  };

  const addComment = async () => {
    if (!selectedVersionId || !canAddComments) return;
    setSubmittingComment(true);
    try {
      const created = isShareMode
        ? await invoke<ReviewCoreComment>("review_core_share_add_comment", {
            token: shareToken,
            assetVersionId: selectedVersionId,
            timestampMs: Math.round(currentTime * 1000),
            text: commentText,
            authorName: commentAuthor,
            sessionToken: shareSessionToken,
          })
        : await invoke<ReviewCoreComment>("review_core_add_comment", {
            assetVersionId: selectedVersionId,
            timestampMs: Math.round(currentTime * 1000),
            text: commentText,
            authorName: commentAuthor,
          });
      setComments((prev) => [...prev, created].sort((a, b) => a.timestamp_ms - b.timestamp_ms));
      setCommentText("");
    } catch (error) {
      console.error("Failed adding comment", error);
      onError?.({ title: "Add comment failed", hint: String(error) });
    } finally {
      setSubmittingComment(false);
    }
  };

  const seekToComment = (comment: ReviewCoreComment) => {
    handleThumbnailSeek(comment.timestamp_ms / 1000);
    setHighlightedCommentId(comment.id);
    window.setTimeout(() => setHighlightedCommentId((current) => (current === comment.id ? null : current)), 1500);
  };

  const toggleResolved = async (comment: ReviewCoreComment) => {
    if (isShareMode) return;
    try {
      const updated = await invoke<ReviewCoreComment>("review_core_update_comment", {
        commentId: comment.id,
        updates: { resolved: !comment.resolved },
      });
      setComments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      console.error("Failed updating comment", error);
      onError?.({ title: "Comment update failed", hint: String(error) });
    }
  };

  const saveEditedComment = async (commentId: string) => {
    setSavingCommentId(commentId);
    try {
      const updated = await invoke<ReviewCoreComment>("review_core_update_comment", {
        commentId,
        updates: { text: editingCommentText },
      });
      setComments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (error) {
      console.error("Failed updating comment text", error);
      onError?.({ title: "Edit comment failed", hint: String(error) });
    } finally {
      setSavingCommentId(null);
    }
  };

  const deleteComment = async (comment: ReviewCoreComment) => {
    if (isShareMode || !window.confirm("Delete this comment?")) return;
    try {
      await invoke("review_core_delete_comment", { commentId: comment.id });
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
      setAnnotations((prev) => prev.filter((item) => item.comment_id !== comment.id));
    } catch (error) {
      console.error("Failed deleting comment", error);
      onError?.({ title: "Delete comment failed", hint: String(error) });
    }
  };

  const handleApprovalChange = async (status: ApprovalStatus) => {
    if (!selectedVersionId || isShareMode) return;
    setSavingApproval(true);
    try {
      const nextApproval = await invoke<ReviewCoreApprovalState>("review_core_set_approval", {
        assetVersionId: selectedVersionId,
        status,
        approvedBy: status === "approved" || status === "rejected" ? approvalName : undefined,
      });
      setApproval(nextApproval);
      if (nextApproval.approved_by) {
        setApprovalName(nextApproval.approved_by);
      }
    } catch (error) {
      console.error("Failed setting approval", error);
      onError?.({ title: "Approval update failed", hint: String(error) });
    } finally {
      setSavingApproval(false);
    }
  };

  const openAnnotationEditor = (comment: ReviewCoreComment) => {
    if (isShareMode) return;
    seekToComment(comment);
    videoRef.current?.pause();
    const existing = annotationsByCommentId.get(comment.id);
    setAnnotatingCommentId(comment.id);
    setAnnotationTool("pointer");
    setSelectedAnnotationItemId(null);
    setActiveDraftItem(null);
    setAnnotationDraft(existing ? parseAnnotationData(existing.vector_data, comment.id, comment.timestamp_ms) : createEmptyAnnotationDraft(comment));
  };

  const cancelAnnotationEditor = () => {
    setAnnotatingCommentId(null);
    setAnnotationDraft(null);
    setSelectedAnnotationItemId(null);
    setActiveDraftItem(null);
    dragStateRef.current = null;
  };

  const saveAnnotation = async () => {
    if (!annotatingCommentId || !annotationDraft || isShareMode) return;
    setSavingAnnotation(true);
    try {
      const saved = await invoke<ReviewCoreAnnotation>("review_core_add_annotation", {
        commentId: annotatingCommentId,
        vectorDataJson: JSON.stringify(annotationDraft),
      });
      setAnnotations((prev) => [...prev.filter((item) => item.comment_id !== annotatingCommentId), saved]);
      cancelAnnotationEditor();
    } catch (error) {
      console.error("Failed saving annotation", error);
      onError?.({ title: "Save annotation failed", hint: String(error) });
    } finally {
      setSavingAnnotation(false);
    }
  };

  const deleteAnnotation = async () => {
    if (!annotatingCommentId || isShareMode) return;
    const existing = annotationsByCommentId.get(annotatingCommentId);
    if (!existing) {
      cancelAnnotationEditor();
      return;
    }
    try {
      await invoke("review_core_delete_annotation", { annotationId: existing.id });
      setAnnotations((prev) => prev.filter((item) => item.id !== existing.id));
      cancelAnnotationEditor();
    } catch (error) {
      console.error("Failed deleting annotation", error);
      onError?.({ title: "Delete annotation failed", hint: String(error) });
    }
  };

  const handleVerifyPassword = async () => {
    if (!shareToken) return;
    setVerifyingSharePassword(true);
    try {
      const unlock = await invoke<ReviewCoreShareUnlockResult>("review_core_share_unlock", {
        token: shareToken,
        password: sharePasswordInput,
      });
      if (unlock.session_token) {
        setShareUnlocked(true);
        setShareSessionToken(unlock.session_token || null);
        setSharePasswordError(null);
      } else {
        setSharePasswordError("Password incorrect.");
      }
    } catch (error) {
      setSharePasswordError(String(error));
    } finally {
      setVerifyingSharePassword(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    if (!navigator.clipboard?.writeText) {
      return false;
    }
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.warn("Clipboard write failed", error);
      return false;
    }
  };

  const handleCreateShareLink = async () => {
    if (!effectiveProjectId || isShareMode) return;
    setCreatingShareLink(true);
    try {
      const created = await invoke<ReviewCoreShareLinkSummary>("review_core_create_share_link", {
        projectId: effectiveProjectId,
        assetVersionIds: shareVersionIds,
        expiresAt: shareExpiryLocal ? new Date(shareExpiryLocal).toISOString() : null,
        password: sharePassword || null,
        allowComments: shareAllowComments,
        allowDownload: shareAllowDownload,
      });
      setShareLinks((prev) => [created, ...prev]);
      setSharePassword("");
      setShareExpiryLocal("");
      setCopiedShareLinkId(created.id);
      const copied = await copyToClipboard(buildShareLink(created.token));
      if (!copied) {
        onError?.({
          title: "Share link created",
          hint: "Copy was blocked by the browser. Use the Copy link button to try again.",
        });
      }
    } catch (error) {
      console.error("Failed creating share link", error);
      onError?.({ title: "Create share link failed", hint: String(error) });
    } finally {
      setCreatingShareLink(false);
    }
  };

  const handleCopyShareLink = async (shareLink: ReviewCoreShareLinkSummary) => {
    const copied = await copyToClipboard(buildShareLink(shareLink.token));
    if (!copied) {
      onError?.({
        title: "Copy share link failed",
        hint: "Clipboard access was blocked in this context.",
      });
      return;
    }
    setCopiedShareLinkId(shareLink.id);
    window.setTimeout(() => setCopiedShareLinkId((current) => (current === shareLink.id ? null : current)), 1500);
  };

  const handleRevokeShareLink = async (shareLinkId: string) => {
    if (!window.confirm("Revoke this share link?")) return;
    try {
      await invoke("review_core_revoke_share_link", { shareLinkId });
      setShareLinks((prev) => prev.filter((item) => item.id !== shareLinkId));
    } catch (error) {
      console.error("Failed revoking share link", error);
      onError?.({ title: "Revoke share link failed", hint: String(error) });
    }
  };

  const handleDownload = async () => {
    if (!shareToken || !selectedVersionId || !shareResolved?.allow_download || !selectedAsset) return;
    const outputPath = await save({
      title: "Save shared media",
      defaultPath: selectedAsset.filename,
    });
    if (!outputPath) return;
    setDownloading(true);
    try {
      await invoke("review_core_share_export_download", {
        token: shareToken,
        assetVersionId: selectedVersionId,
        outputPath,
        sessionToken: shareSessionToken,
      });
    } catch (error) {
      console.error("Failed downloading shared media", error);
      onError?.({ title: "Download failed", hint: String(error) });
    } finally {
      setDownloading(false);
    }
  };

  const pointerToNormalized = (event: React.PointerEvent<SVGSVGElement>): NormalizedPoint | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return [clamp01((event.clientX - rect.left) / rect.width), clamp01((event.clientY - rect.top) / rect.height)];
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!annotationDraft || isShareMode) return;
    const point = pointerToNormalized(event);
    if (!point) return;

    if (annotationTool === "pointer") {
      const hit = hitTestAnnotationItem(annotationDraft.items, point);
      setSelectedAnnotationItemId(hit?.id || null);
      if (hit) {
        dragStateRef.current = { mode: "move", start: point, itemId: hit.id };
      }
      return;
    }

    if (annotationTool === "text") {
      const text = annotationTextValue.trim() || "Note";
      const item: TextItem = {
        id: createItemId(),
        type: "text",
        x: point[0],
        y: point[1],
        text,
        style: DEFAULT_ANNOTATION_STYLE,
      };
      setAnnotationDraft((current) => (current ? { ...current, items: [...current.items, item] } : current));
      setSelectedAnnotationItemId(item.id);
      return;
    }

    const nextItem = createDraftItem(annotationTool, point);
    if (!nextItem) return;
    setActiveDraftItem(nextItem);
    setSelectedAnnotationItemId(nextItem.id);
    dragStateRef.current = { mode: "draw", start: point, itemId: nextItem.id };
  };

  const handleOverlayPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    if (!drag || !annotationDraft || isShareMode) return;
    const point = pointerToNormalized(event);
    if (!point) return;

    if (drag.mode === "draw" && activeDraftItem) {
      setActiveDraftItem(updateDraftItem(activeDraftItem, drag.start, point));
      return;
    }

    if (drag.mode === "move" && drag.itemId) {
      const deltaX = point[0] - drag.start[0];
      const deltaY = point[1] - drag.start[1];
      dragStateRef.current = { ...drag, start: point };
      setAnnotationDraft((current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => (item.id === drag.itemId ? translateAnnotationItem(item, deltaX, deltaY) : item)),
        };
      });
    }
  };

  const handleOverlayPointerUp = () => {
    const drag = dragStateRef.current;
    dragStateRef.current = null;
    if (drag?.mode === "draw" && activeDraftItem) {
      setAnnotationDraft((current) => (current ? { ...current, items: [...current.items, activeDraftItem] } : current));
      setActiveDraftItem(null);
    }
  };

  const displayedAnnotation = annotatingCommentId ? annotationDraft : parsedActiveAnnotation;
  const overlayVisible = Boolean(annotatingCommentId || displayedAnnotation);

  if (isShareMode && shareResolved?.password_required && !shareUnlocked) {
    return (
      <div className="review-core-shell review-core-share-shell">
        <div className="review-core-share-gate premium-card">
          <div className="section-title">Shared Review</div>
          <p>This review link is password protected.</p>
          <input
            className="input-text"
            type="password"
            value={sharePasswordInput}
            onChange={(event) => setSharePasswordInput(event.target.value)}
            placeholder="Enter password"
            onKeyDown={(event) => {
              if (event.key === "Enter") handleVerifyPassword();
            }}
          />
          {sharePasswordError && <div className="error-banner">{sharePasswordError}</div>}
          <div className="review-core-share-gate-actions">
            {onExitShare && (
              <button className="btn btn-secondary btn-sm" onClick={onExitShare}>
                Back
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={handleVerifyPassword} disabled={verifyingSharePassword}>
              <KeyRound size={14} />
              <span>{verifyingSharePassword ? "Unlocking…" : "Unlock"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`review-core-shell ${isShareMode ? "review-core-share-shell" : ""} ${restricted ? "review-core-restricted-shell" : ""}`}>
      <div className="review-core-toolbar premium-toolbar">
        <div>
          <div className="section-title">{isShareMode ? "Shared Review" : "Review Core"}</div>
          <div className="review-core-subtitle">
            {displayProjectName} · {isShareMode ? "Restricted review link" : "App-managed proxy review"}
          </div>
        </div>
        <div className="review-core-toolbar-actions">
          {isShareMode ? (
            <>
              {shareResolved?.allow_download && (
                <button className="btn btn-secondary btn-sm" onClick={handleDownload} disabled={downloading || !selectedVersionId}>
                  {downloading ? <LoaderCircle size={14} className="review-core-spin" /> : <ShieldCheck size={14} />}
                  <span>{downloading ? "Saving…" : "Download Original"}</span>
                </button>
              )}
              {onExitShare && (
                <button className="btn btn-secondary btn-sm" onClick={onExitShare}>
                  Back
                </button>
              )}
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={handleImport} disabled={importing}>
              {importing ? <LoaderCircle size={14} className="review-core-spin" /> : <FolderUp size={14} />}
              <span>{importing ? "Importing…" : "Import Files"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="review-core-layout">
        <aside className="review-core-sidebar">
          <div className="section-header">
            <span className="section-title">Assets</span>
            <span className="section-count highlight">{assets.length}</span>
          </div>
          {loading ? (
            <div className="empty-state">Loading Review Core assets…</div>
          ) : assets.length === 0 ? (
            <div className="empty-state review-core-empty">
              <Film size={18} />
              <p>{isShareMode ? "No shared versions are available for this link." : <>No imported assets yet. Use <strong>Import Files</strong> to copy media into app-managed storage for proxy review.</>}</p>
            </div>
          ) : (
            <div className="review-core-asset-list">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  className={`review-core-asset-card ${selectedAssetId === asset.id ? "active" : ""}`}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <div className="review-core-asset-header">
                    <span className="review-core-asset-name">{asset.filename}</span>
                    <span className={`review-core-status review-core-status-${asset.status}`}>{asset.status}</span>
                  </div>
                  <div className="review-core-asset-meta">
                    <span>{formatDuration(asset.duration_ms)}</span>
                    <span>{formatResolution(asset)}</span>
                    <span>{formatFps(asset.frame_rate)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="review-core-main">
          {selectedAsset ? (
            <>
              <div className="review-core-player-card">
                <div className="review-core-player-header">
                  <div>
                    <h3>{selectedAsset.filename}</h3>
                    <p>{selectedAsset.codec || "Unknown codec"} · {formatResolution(selectedAsset)} · {formatFps(selectedAsset.frame_rate)}</p>
                  </div>
                  <div className="review-core-player-tools">
                    <div className="review-core-player-controls">
                      <select
                        className="input-select"
                        value={selectedVersionId || ""}
                        onChange={(event) => setSelectedVersionId(event.target.value)}
                      >
                        {versions.map((version) => (
                          <option key={version.id} value={version.id}>
                            Version {version.version_number} · {version.processing_status}
                          </option>
                        ))}
                      </select>
                      <div className="review-core-timecode">
                        <PlayCircle size={14} />
                        <span>{formatTimecode(currentTime, selectedAsset)} / {formatTimecode(duration, selectedAsset)}</span>
                      </div>
                    </div>
                    {!isShareMode && (
                      <div className="review-core-approval-block">
                        <label className="review-core-approval-label">Approval</label>
                        <div className="review-core-approval-controls">
                          <select
                            className="input-select"
                            value={approval.status}
                            onChange={(event) => handleApprovalChange(event.target.value as ApprovalStatus)}
                            disabled={!selectedVersionId || savingApproval}
                          >
                            <option value="draft">Draft</option>
                            <option value="in_review">In Review</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          {(approval.status === "approved" || approval.status === "rejected") && (
                            <input
                              className="input-text review-core-approval-name"
                              value={approvalName}
                              onChange={(event) => setApprovalName(event.target.value)}
                              onBlur={() => handleApprovalChange(approval.status)}
                              placeholder="Approved by"
                              maxLength={80}
                            />
                          )}
                        </div>
                        {(approval.status === "approved" || approval.status === "rejected") && approval.approved_at && (
                          <div className="review-core-approval-meta">
                            {approval.approved_by || "Anonymous"} · {new Date(approval.approved_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="review-core-video-frame" ref={playerFrameRef}>
                  <video ref={videoRef} controls playsInline preload="metadata" />
                  {overlayVisible && frameRect.width > 0 && frameRect.height > 0 && (
                    <div
                      className={`review-core-annotation-layer ${annotatingCommentId ? "editing" : "viewing"}`}
                      style={{
                        left: `${frameRect.left}px`,
                        top: `${frameRect.top}px`,
                        width: `${frameRect.width}px`,
                        height: `${frameRect.height}px`,
                      }}
                    >
                      {annotatingCommentId && !isShareMode && (
                        <div className="review-core-annotation-toolbar">
                          <button className={`btn btn-secondary btn-sm ${annotationTool === "pointer" ? "active" : ""}`} onClick={() => setAnnotationTool("pointer")}><MousePointer2 size={14} /></button>
                          <button className={`btn btn-secondary btn-sm ${annotationTool === "pen" ? "active" : ""}`} onClick={() => setAnnotationTool("pen")}><PenTool size={14} /></button>
                          <button className={`btn btn-secondary btn-sm ${annotationTool === "arrow" ? "active" : ""}`} onClick={() => setAnnotationTool("arrow")}><ChevronRight size={14} /></button>
                          <button className={`btn btn-secondary btn-sm ${annotationTool === "rect" ? "active" : ""}`} onClick={() => setAnnotationTool("rect")}><RectangleHorizontal size={14} /></button>
                          <button className={`btn btn-secondary btn-sm ${annotationTool === "circle" ? "active" : ""}`} onClick={() => setAnnotationTool("circle")}><Circle size={14} /></button>
                          <button className={`btn btn-secondary btn-sm ${annotationTool === "text" ? "active" : ""}`} onClick={() => setAnnotationTool("text")}><Type size={14} /></button>
                          {annotationTool === "text" && (
                            <input
                              className="input-text review-core-annotation-text-input"
                              value={annotationTextValue}
                              onChange={(event) => setAnnotationTextValue(event.target.value)}
                              maxLength={120}
                            />
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={!selectedAnnotationItemId}
                            onClick={() =>
                              setAnnotationDraft((current) =>
                                current ? { ...current, items: current.items.filter((item) => item.id !== selectedAnnotationItemId) } : current
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                      <svg
                        className="review-core-annotation-svg"
                        viewBox="0 0 1000 1000"
                        preserveAspectRatio="none"
                        onPointerDown={!isShareMode && annotatingCommentId ? handleOverlayPointerDown : undefined}
                        onPointerMove={!isShareMode && annotatingCommentId ? handleOverlayPointerMove : undefined}
                        onPointerUp={!isShareMode && annotatingCommentId ? handleOverlayPointerUp : undefined}
                        onPointerLeave={!isShareMode && annotatingCommentId ? handleOverlayPointerUp : undefined}
                      >
                        {renderAnnotationItems(displayedAnnotation?.items || [], selectedAnnotationItemId)}
                        {activeDraftItem && renderAnnotationItems([activeDraftItem], selectedAnnotationItemId)}
                      </svg>
                      {annotatingCommentId && !isShareMode && (
                        <div className="review-core-annotation-footer">
                          <span>Annotation at {formatTimecode((activeEditingComment?.timestamp_ms || 0) / 1000, selectedAsset)}</span>
                          <div className="review-core-annotation-footer-actions">
                            <button className="btn btn-secondary btn-sm" onClick={cancelAnnotationEditor}>Cancel</button>
                            <button className="btn btn-secondary btn-sm" onClick={deleteAnnotation} disabled={!annotationsByCommentId.get(annotatingCommentId)}>Remove</button>
                            <button className="btn btn-secondary btn-sm" onClick={saveAnnotation} disabled={savingAnnotation || !annotationDraft}>
                              <SaveIcon size={14} />
                              <span>{savingAnnotation ? "Saving…" : "Save"}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedVersion && selectedVersion.processing_status !== "ready" && (
                    <div className="review-core-player-overlay">
                      {selectedVersion.processing_status === "failed"
                        ? "Processing failed. Re-import the asset to retry."
                        : "Processing proxy, poster, and thumbnails…"}
                    </div>
                  )}
                </div>

                {thumbnails.length > 0 && serverBaseUrl && selectedVersion && (
                  <div className="review-core-thumb-strip">
                    {thumbnails.map((thumb) => {
                      const thumbQueryParts: string[] = [];
                      if (isShareMode && shareToken) thumbQueryParts.push(`t=${encodeURIComponent(shareToken)}`);
                      if (isShareMode && shareSessionToken) thumbQueryParts.push(`s=${encodeURIComponent(shareSessionToken)}`);
                      const tokenQuery = thumbQueryParts.length > 0 ? `?${thumbQueryParts.join("&")}` : "";
                      const thumbUrl = `${serverBaseUrl}/media/${selectedAsset.project_id}/${selectedAsset.id}/${selectedVersion.id}/thumbs/${thumb.file_name}${tokenQuery}`;
                      return (
                        <button
                          key={thumb.file_name}
                          className="review-core-thumb-button"
                          onClick={() => handleThumbnailSeek(thumb.approx_seconds)}
                          title={`Seek to ${formatApproxTime(thumb.approx_seconds)}`}
                        >
                          <img src={thumbUrl} alt={thumb.file_name} />
                          <span>{formatApproxTime(thumb.approx_seconds)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedVersion?.processing_status === "failed" && getVersionLastError(selectedVersion, selectedAsset) && (
                  <div className="review-core-error-card">
                    <button className="review-core-error-toggle" onClick={() => setShowErrorDetails((value) => !value)}>
                      {showErrorDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>Processing error</span>
                    </button>
                    {showErrorDetails && (
                      <pre className="review-core-error-body">
                        {getVersionLastError(selectedVersion, selectedAsset)}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              <div className="review-core-metadata-grid">
                <div className="review-core-meta-card">
                  <span className="review-core-meta-label">Duration</span>
                  <strong>{formatDuration(selectedAsset.duration_ms)}</strong>
                </div>
                <div className="review-core-meta-card">
                  <span className="review-core-meta-label">Resolution</span>
                  <strong>{formatResolution(selectedAsset)}</strong>
                </div>
                <div className="review-core-meta-card">
                  <span className="review-core-meta-label">Frame Rate</span>
                  <strong>{formatFps(selectedAsset.frame_rate)}</strong>
                </div>
                {!isShareMode && isInternalAsset(selectedAsset) && (
                  <div className="review-core-meta-card">
                    <span className="review-core-meta-label">Checksum</span>
                    <strong>{selectedAsset.checksum_sha256.slice(0, 16)}…</strong>
                  </div>
                )}
              </div>

              {canShowComments && (
                <div className="review-core-comments-card">
                  <div className="section-header">
                    <span className="section-title">Comments</span>
                    <span className="section-count highlight">{comments.length}</span>
                  </div>
                  {canAddComments && (
                    <div className="review-core-comment-composer">
                      <div className="review-core-comment-meta">
                        <span>Current time</span>
                        <strong>{formatTimecode(currentTime, selectedAsset)}</strong>
                      </div>
                      <input
                        className="input-text"
                        value={commentAuthor}
                        onChange={(event) => setCommentAuthor(event.target.value)}
                        placeholder="Author"
                        maxLength={80}
                      />
                      <textarea
                        className="input-text review-core-comment-textarea"
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        placeholder="Add a version-scoped comment"
                        maxLength={2000}
                        onKeyDown={(event) => {
                          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault();
                            addComment();
                          }
                        }}
                      />
                      <div className="review-core-comment-actions">
                        <span className="review-core-comment-shortcut">Cmd/Ctrl + Enter</span>
                        <button className="btn btn-secondary btn-sm" onClick={addComment} disabled={submittingComment || !selectedVersionId}>
                          {submittingComment ? "Adding…" : "Add"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="review-core-comments-list">
                    {comments.map((comment) => {
                      const isEditing = editingCommentId === comment.id;
                      const hasAnnotation = annotationsByCommentId.has(comment.id);
                      return (
                        <div
                          key={comment.id}
                          className={`review-core-comment-row ${highlightedCommentId === comment.id ? "highlighted" : ""} ${comment.resolved ? "resolved" : ""}`}
                        >
                          <div className="review-core-comment-main">
                            <button className="review-core-comment-jump" onClick={() => seekToComment(comment)}>
                              <div className="review-core-comment-head">
                                <strong>{formatTimecode(comment.timestamp_ms / 1000, selectedAsset)}</strong>
                                {comment.frame_number != null && !selectedAsset.is_vfr && (
                                  <span className="review-core-comment-frame">Frame {comment.frame_number}</span>
                                )}
                                {hasAnnotation && <span className="review-core-comment-badge">Annotated</span>}
                              </div>
                              {!isEditing && <p>{comment.text}</p>}
                              {!isEditing && <span className="review-core-comment-author">{comment.author_name}</span>}
                            </button>
                            {isEditing && !isShareMode && (
                              <div className="review-core-comment-edit">
                                <textarea
                                  className="input-text review-core-comment-textarea"
                                  value={editingCommentText}
                                  onChange={(event) => setEditingCommentText(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      setEditingCommentId(null);
                                      setEditingCommentText("");
                                    }
                                  }}
                                />
                                <div className="review-core-comment-edit-actions">
                                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }}>
                                    Cancel
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => saveEditedComment(comment.id)} disabled={savingCommentId === comment.id}>
                                    {savingCommentId === comment.id ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {!isShareMode ? (
                            <div className="review-core-comment-row-actions">
                              <button className="btn btn-secondary btn-sm" onClick={() => toggleResolved(comment)}>
                                {comment.resolved ? "Unresolve" : "Resolve"}
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.text); }}>
                                <Edit3 size={14} />
                                <span>Edit</span>
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openAnnotationEditor(comment)}>
                                <PenTool size={14} />
                                <span>Annotate</span>
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => deleteComment(comment)}>
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div className="review-core-comment-row-actions">
                              <button className="btn btn-secondary btn-sm" onClick={() => seekToComment(comment)}>
                                Jump
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {comments.length === 0 && (
                      <div className="empty-state" style={{ padding: "16px 0" }}>
                        No comments for this version yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isShareMode && (
                <div className="review-core-share-card">
                  <div className="section-header">
                    <span className="section-title">Share</span>
                    <span className="section-count highlight">{shareLinks.length}</span>
                  </div>
                  <div className="review-core-share-form">
                    <div className="review-core-share-version-list">
                      {versions.map((version) => (
                        <label key={version.id} className="review-core-share-version-option">
                          <input
                            type="checkbox"
                            checked={shareVersionIds.includes(version.id)}
                            onChange={() =>
                              setShareVersionIds((prev) =>
                                prev.includes(version.id) ? prev.filter((item) => item !== version.id) : [...prev, version.id].sort()
                              )
                            }
                          />
                          <span>Version {version.version_number}</span>
                        </label>
                      ))}
                    </div>
                    <div className="review-core-share-options">
                      <label className="review-core-share-toggle">
                        <input type="checkbox" checked={shareAllowComments} onChange={(event) => setShareAllowComments(event.target.checked)} />
                        <span>Allow comments</span>
                      </label>
                      <label className="review-core-share-toggle">
                        <input type="checkbox" checked={shareAllowDownload} onChange={(event) => setShareAllowDownload(event.target.checked)} />
                        <span>Allow download</span>
                      </label>
                    </div>
                    <div className="review-core-share-fields">
                      <input
                        className="input-text"
                        type="datetime-local"
                        value={shareExpiryLocal}
                        onChange={(event) => setShareExpiryLocal(event.target.value)}
                      />
                      <input
                        className="input-text"
                        type="password"
                        value={sharePassword}
                        onChange={(event) => setSharePassword(event.target.value)}
                        placeholder="Optional password"
                        maxLength={120}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleCreateShareLink}
                        disabled={creatingShareLink || shareVersionIds.length === 0}
                      >
                        <Link2 size={14} />
                        <span>{creatingShareLink ? "Creating…" : "Create share link"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="review-core-share-links-list">
                    {shareLinks.map((shareLink) => (
                      <div key={shareLink.id} className="review-core-share-link-row">
                        <div className="review-core-share-link-main">
                          <strong>{buildShareLink(shareLink.token)}</strong>
                          <span>
                            {shareLink.asset_version_ids.length} version{shareLink.asset_version_ids.length !== 1 ? "s" : ""} ·
                            {shareLink.allow_comments ? " comments" : " read-only"} ·
                            {shareLink.allow_download ? " download" : " no download"}
                            {shareLink.expires_at ? ` · expires ${new Date(shareLink.expires_at).toLocaleString()}` : ""}
                            {shareLink.password_required ? " · password" : ""}
                          </span>
                        </div>
                        <div className="review-core-share-link-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleCopyShareLink(shareLink)}>
                            <Copy size={14} />
                            <span>{copiedShareLinkId === shareLink.id ? "Copied" : "Copy link"}</span>
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleRevokeShareLink(shareLink.id)}>
                            <Trash2 size={14} />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </div>
                    ))}
                    {shareLinks.length === 0 && <div className="empty-state">No share links created yet.</div>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">Select an asset to open the Review Core player.</div>
          )}
        </section>
      </div>

      {!isShareMode && pendingDuplicateFiles && duplicateCandidates.length > 0 && (
        <div className="review-core-duplicate-backdrop">
          <div className="review-core-duplicate-modal">
            <h3>Already imported</h3>
            <p>These files match media already imported for this workspace. The default action is to create a new version under the existing asset.</p>
            <div className="review-core-duplicate-list">
              {duplicateCandidates.map((item) => (
                <div key={`${item.file_path}-${item.existing_asset_id}`} className="review-core-duplicate-row">
                  <strong>{item.existing_filename}</strong>
                  <span>{item.file_path}</span>
                </div>
              ))}
            </div>
            <div className="review-core-duplicate-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => { setPendingDuplicateFiles(null); setDuplicateCandidates([]); }}>
                Cancel
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => runIngest(pendingDuplicateFiles, "new_asset")}>
                Import as new asset anyway
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => runIngest(pendingDuplicateFiles, "new_version")}>
                Create new version under existing asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildShareLink(token: string) {
  return `${window.location.origin}/#/r/${token}`;
}

function isInternalAsset(asset: CommonAsset): asset is ReviewCoreAsset {
  return "checksum_sha256" in asset;
}

function getVersionLastError(version: CommonVersion | null, asset: CommonAsset | null) {
  const versionError = version && "last_error" in version ? version.last_error : null;
  const assetError = asset && isInternalAsset(asset) ? asset.last_error : null;
  return versionError || assetError || null;
}

function createEmptyAnnotationDraft(comment: ReviewCoreComment): AnnotationVectorData {
  return {
    schemaVersion: 1,
    commentId: comment.id,
    timestampMs: comment.timestamp_ms,
    items: [],
  };
}

function parseAnnotationData(raw?: string | null, commentId?: string, timestampMs?: number): AnnotationVectorData | null {
  if (!raw) {
    return commentId && timestampMs != null
      ? { schemaVersion: 1, commentId, timestampMs, items: [] }
      : null;
  }
  try {
    const parsed = JSON.parse(raw) as AnnotationVectorData;
    return {
      schemaVersion: 1,
      commentId: parsed.commentId || commentId || "",
      timestampMs: parsed.timestampMs ?? timestampMs ?? 0,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return commentId && timestampMs != null
      ? { schemaVersion: 1, commentId, timestampMs, items: [] }
      : null;
  }
}

function createItemId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftItem(tool: AnnotationTool, point: NormalizedPoint): AnnotationItem | null {
  const id = createItemId();
  if (tool === "pen") {
    return { id, type: "pen", points: [point, point], style: DEFAULT_ANNOTATION_STYLE };
  }
  if (tool === "arrow") {
    return { id, type: "arrow", a: point, b: point, style: DEFAULT_ANNOTATION_STYLE };
  }
  if (tool === "rect") {
    return { id, type: "rect", x: point[0], y: point[1], w: 0, h: 0, style: DEFAULT_ANNOTATION_STYLE };
  }
  if (tool === "circle") {
    return { id, type: "circle", x: point[0], y: point[1], w: 0, h: 0, style: DEFAULT_ANNOTATION_STYLE };
  }
  return null;
}

function updateDraftItem(item: AnnotationItem, start: NormalizedPoint, point: NormalizedPoint): AnnotationItem {
  if (item.type === "pen") {
    return { ...item, points: [...item.points, point] };
  }
  if (item.type === "arrow") {
    return { ...item, b: point };
  }
  if (item.type === "rect" || item.type === "circle") {
    return {
      ...item,
      x: Math.min(start[0], point[0]),
      y: Math.min(start[1], point[1]),
      w: Math.abs(point[0] - start[0]),
      h: Math.abs(point[1] - start[1]),
    };
  }
  return item;
}

function translateAnnotationItem(item: AnnotationItem, deltaX: number, deltaY: number): AnnotationItem {
  if (item.type === "arrow") {
    return {
      ...item,
      a: [clamp01(item.a[0] + deltaX), clamp01(item.a[1] + deltaY)],
      b: [clamp01(item.b[0] + deltaX), clamp01(item.b[1] + deltaY)],
    };
  }
  if (item.type === "pen") {
    return {
      ...item,
      points: item.points.map(([x, y]) => [clamp01(x + deltaX), clamp01(y + deltaY)]),
    };
  }
  if (item.type === "text") {
    return { ...item, x: clamp01(item.x + deltaX), y: clamp01(item.y + deltaY) };
  }
  return {
    ...item,
    x: clamp01(item.x + deltaX),
    y: clamp01(item.y + deltaY),
  };
}

function hitTestAnnotationItem(items: AnnotationItem[], point: NormalizedPoint): AnnotationItem | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.type === "arrow") {
      if (distanceToSegment(point, item.a, item.b) <= 0.03) return item;
      continue;
    }
    if (item.type === "pen") {
      for (let i = 1; i < item.points.length; i += 1) {
        if (distanceToSegment(point, item.points[i - 1], item.points[i]) <= 0.025) return item;
      }
      continue;
    }
    if (item.type === "text") {
      if (Math.abs(point[0] - item.x) <= 0.06 && Math.abs(point[1] - item.y) <= 0.03) return item;
      continue;
    }
    if (point[0] >= item.x && point[0] <= item.x + item.w && point[1] >= item.y && point[1] <= item.y + item.h) {
      return item;
    }
  }
  return null;
}

function distanceToSegment(point: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint) {
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  const clamped = Math.max(0, Math.min(1, t));
  const cx = ax + clamped * dx;
  const cy = ay + clamped * dy;
  return Math.hypot(px - cx, py - cy);
}

function renderAnnotationItems(items: AnnotationItem[], selectedId: string | null) {
  return items.map((item) => {
    const isSelected = item.id === selectedId;
    const strokeWidth = (item.style?.width || 2) * (isSelected ? 1.4 : 1);
    const stroke = item.style?.stroke || DEFAULT_ANNOTATION_STYLE.stroke;
    if (item.type === "arrow") {
      return (
        <g key={item.id}>
          <defs>
            <marker id={`arrow-head-${item.id}`} markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={stroke} />
            </marker>
          </defs>
          <line
            x1={item.a[0] * 1000}
            y1={item.a[1] * 1000}
            x2={item.b[0] * 1000}
            y2={item.b[1] * 1000}
            stroke={stroke}
            strokeWidth={strokeWidth}
            markerEnd={`url(#arrow-head-${item.id})`}
          />
        </g>
      );
    }
    if (item.type === "pen") {
      const d = item.points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x * 1000} ${y * 1000}`).join(" ");
      return <path key={item.id} d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
    }
    if (item.type === "rect") {
      return <rect key={item.id} x={item.x * 1000} y={item.y * 1000} width={item.w * 1000} height={item.h * 1000} fill="none" stroke={stroke} strokeWidth={strokeWidth} />;
    }
    if (item.type === "circle") {
      return (
        <ellipse
          key={item.id}
          cx={(item.x + item.w / 2) * 1000}
          cy={(item.y + item.h / 2) * 1000}
          rx={(item.w * 1000) / 2}
          ry={(item.h * 1000) / 2}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    return (
      <text key={item.id} x={item.x * 1000} y={item.y * 1000} fill={stroke} fontSize={22} fontWeight={600}>
        {item.text}
      </text>
    );
  });
}

function getVideoFrameRect(container: HTMLDivElement, video: HTMLVideoElement): OverlayFrameRect {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!video.videoWidth || !video.videoHeight || width <= 0 || height <= 0) {
    return { left: 0, top: 0, width, height };
  }
  const videoAspect = video.videoWidth / video.videoHeight;
  const containerAspect = width / height;
  if (containerAspect > videoAspect) {
    const fittedWidth = height * videoAspect;
    return {
      left: (width - fittedWidth) / 2,
      top: 0,
      width: fittedWidth,
      height,
    };
  }
  const fittedHeight = width / videoAspect;
  return {
    left: 0,
    top: (height - fittedHeight) / 2,
    width,
    height: fittedHeight,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs) return "00:00";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatResolution(asset: Pick<CommonAsset, "width" | "height">) {
  if (!asset.width || !asset.height) return "Unknown res";
  return `${asset.width}×${asset.height}`;
}

function formatFps(fps?: number | null) {
  if (!fps) return "Unknown fps";
  return `${fps.toFixed(2)} fps`;
}

function formatTimecode(seconds: number, asset: Pick<CommonAsset, "frame_rate" | "avg_frame_rate" | "r_frame_rate" | "is_vfr">) {
  const safeFps = normalizePlaybackFps(asset.avg_frame_rate || asset.r_frame_rate, asset.frame_rate);
  if (asset.is_vfr) {
    return formatApproxTime(seconds);
  }
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;
  const frames = Math.floor((seconds - wholeSeconds) * safeFps);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function normalizePlaybackFps(rawRate?: string | null, fallback?: number | null) {
  if (rawRate && rawRate.includes("/")) {
    const [num, den] = rawRate.split("/").map((value) => Number(value));
    if (num > 0 && den > 0) return num / den;
  }
  return fallback && fallback > 0 ? fallback : 24;
}

function formatApproxTime(seconds: number) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;
  const millis = Math.floor((seconds - wholeSeconds) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
