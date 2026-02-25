import { useState, useEffect } from "react";
import { Clip, ClipWithThumbnails } from "../types";
import { FilmStrip } from "./FilmStrip";
import { Film, CheckCircle2, XCircle, Star } from "lucide-react";
import { Waveform } from "./Waveform";
import { LookbookSortMode } from "../lookbook";

interface ClipListProps {
    clips: ClipWithThumbnails[];
    thumbnailCache: Record<string, string>;
    isExtracting: boolean;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    thumbCount: number;
    onUpdateMetadata: (clipId: string, updates: Partial<Pick<Clip, 'rating' | 'flag' | 'notes' | 'shot_size' | 'movement' | 'manual_order'>>) => Promise<void>;
    onHoverClip: (id: string | null) => void;
    onPromoteClip: (id: string) => void;
    onPlayClip: (id: string) => void;
    shotSizeOptions: string[];
    movementOptions: string[];
    lookbookSortMode: LookbookSortMode;
    groupByShotSize: boolean;
}

export function ClipList({
    clips,
    thumbnailCache,
    isExtracting,
    selectedIds,
    onToggleSelection,
    thumbCount,
    onUpdateMetadata,
    onHoverClip,
    onPromoteClip,
    onPlayClip,
    shotSizeOptions,
    movementOptions,
    lookbookSortMode,
    groupByShotSize
}: ClipListProps) {
    if (clips.length === 0) return null;

    return (
        <div>
            <div className="section-header">
                <span className="section-title">Clips</span>
                <span className="section-count highlight">{clips.length}</span>
            </div>
            <div className="clip-list">
                {clips.map((item, idx) => {
                    const prev = idx > 0 ? clips[idx - 1].clip.shot_size : null;
                    const cur = item.clip.shot_size ?? "Unspecified Shot Size";
                    const showGroup = groupByShotSize && (idx === 0 || (prev ?? "Unspecified Shot Size") !== cur);
                    return (
                        <div key={item.clip.id}>
                            {showGroup && <div className="clip-shot-group-header">{cur}</div>}
                            <ClipCard
                                item={item}
                                thumbnailCache={thumbnailCache}
                                isExtracting={isExtracting}
                                isSelected={selectedIds.has(item.clip.id)}
                                onToggle={() => onToggleSelection(item.clip.id)}
                                thumbCount={thumbCount}
                                onUpdateMetadata={onUpdateMetadata}
                                onMouseEnter={() => onHoverClip(item.clip.id)}
                                onMouseLeave={() => onHoverClip(null)}
                                shotSizeOptions={shotSizeOptions}
                                movementOptions={movementOptions}
                                lookbookSortMode={lookbookSortMode}
                                onPromoteClip={() => onPromoteClip(item.clip.id)}
                                onPlayClip={() => onPlayClip(item.clip.id)}
                            />
                        </div>
                    );
                })}
            </div>
            <datalist id="shot-size-options">
                {shotSizeOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
            <datalist id="movement-options">
                {movementOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
        </div>
    );
}

function ClipCard({
    item,
    thumbnailCache,
    isExtracting,
    isSelected,
    onToggle,
    thumbCount,
    onUpdateMetadata,
    onMouseEnter,
    onMouseLeave,
    shotSizeOptions,
    movementOptions,
    lookbookSortMode,
    onPromoteClip,
    onPlayClip,
}: {
    item: ClipWithThumbnails;
    thumbnailCache: Record<string, string>;
    isExtracting: boolean;
    isSelected: boolean;
    onToggle: () => void;
    thumbCount: number;
    onUpdateMetadata: (clipId: string, updates: Partial<Pick<Clip, 'rating' | 'flag' | 'notes' | 'shot_size' | 'movement' | 'manual_order'>>) => Promise<void>;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onPromoteClip: () => void;
    onPlayClip: () => void;
    shotSizeOptions: string[];
    movementOptions: string[];
    lookbookSortMode: LookbookSortMode;
}) {
    const { clip, thumbnails } = item;
    const audioHealth = getAudioHealth(clip.audio_summary, clip.audio_envelope);

    // Local state to prevent jumping during edits
    const [localShotSize, setLocalShotSize] = useState(clip.shot_size ?? "");
    const [localMovement, setLocalMovement] = useState(clip.movement ?? "");
    const [localManualOrder, setLocalManualOrder] = useState(clip.manual_order ?? 0);

    // Keep local state in sync if prop changes from outside (e.g. reload)
    useEffect(() => {
        setLocalShotSize(clip.shot_size ?? "");
    }, [clip.shot_size]);
    useEffect(() => {
        setLocalMovement(clip.movement ?? "");
    }, [clip.movement]);
    useEffect(() => {
        setLocalManualOrder(clip.manual_order ?? 0);
    }, [clip.manual_order]);

    const handleShotSizeBlur = () => {
        if (localShotSize.trim() === (clip.shot_size ?? "")) return;
        if (!localShotSize.trim()) onUpdateMetadata(clip.id, { shot_size: "" });
        else if (shotSizeOptions.includes(localShotSize.trim())) onUpdateMetadata(clip.id, { shot_size: localShotSize.trim() });
        else setLocalShotSize(clip.shot_size ?? ""); // reset if invalid
    };

    const handleMovementBlur = () => {
        if (localMovement.trim() === (clip.movement ?? "")) return;
        if (!localMovement.trim()) onUpdateMetadata(clip.id, { movement: "" });
        else if (movementOptions.includes(localMovement.trim())) onUpdateMetadata(clip.id, { movement: localMovement.trim() });
        else setLocalMovement(clip.movement ?? ""); // reset if invalid
    };

    const handleManualOrderBlur = () => {
        if (localManualOrder === (clip.manual_order ?? 0)) return;
        onUpdateMetadata(clip.id, { manual_order: localManualOrder });
    };

    return (
        <div
            className={`clip-card ${isSelected ? 'selected' : ''} flag-${clip.flag}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onDoubleClick={(e) => {
                // Only promote if not double-clicking interactive elements
                if ((e.target as HTMLElement).closest('button, input, select')) return;
                onPromoteClip();
            }}
        >
            {/* Header */}
            <div className="clip-card-header">
                <div className="clip-card-title-group">
                    <span className="clip-filename">
                        <Film size={14} style={{ opacity: 0.6 }} /> {clip.filename}
                    </span>
                </div>
                <div className="clip-card-header-right">
                    <div className="clip-rating">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                size={14}
                                className={`star ${star <= clip.rating ? 'filled' : ''}`}
                                onClick={() => onUpdateMetadata(clip.id, { rating: star === clip.rating ? 0 : star })}
                            />
                        ))}
                    </div>
                    <div className="clip-flags">
                        <button
                            className={`btn-flag btn-reject ${clip.flag === 'reject' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const nextFlag = clip.flag === 'reject' ? 'none' : 'reject';
                                onUpdateMetadata(clip.id, { flag: nextFlag });
                                if (nextFlag === "reject" && !isSelected) {
                                    onToggle();
                                }
                            }}
                            title="Reject (R)"
                            aria-label="Reject"
                        >
                            <XCircle size={14} />
                            <span>Reject</span>
                        </button>
                    </div>

                    <button
                        className={`btn-flag btn-select ${isSelected ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onToggle(); }}
                        title="Select for export"
                        aria-label="Select"
                        disabled={clip.flag === "reject"}
                    >
                        <CheckCircle2 size={14} />
                        <span>{isSelected ? "Selected" : "Select"}</span>
                    </button>
                </div>
            </div>

            <div className="clip-card-media">
                <FilmStrip
                    clipId={clip.id}
                    thumbnails={thumbnails}
                    thumbnailCache={thumbnailCache}
                    status={clip.status}
                    count={thumbCount}
                    aspectRatio={clip.width > 0 && clip.height > 0 ? clip.width / clip.height : 16 / 9}
                    isExtracting={isExtracting}
                    onDoubleClick={onPlayClip}
                />
            </div>

            {/* Actions / Metadata */}
            <div className="clip-card-footer">
                <div className="clip-metadata-compact">
                    <span className="metadata-tag">{formatDuration(clip.duration_ms)}</span>
                    <span className="metadata-tag">{clip.format_name.toUpperCase()}</span>
                    <span className="metadata-tag">{clip.video_codec.toUpperCase()}</span>
                    {clip.video_bitrate > 0 && (
                        <span className="metadata-tag highlight-tag">
                            {Math.round(clip.video_bitrate / 1_000_000)} Mbps
                        </span>
                    )}
                    {audioHealth && <span className="metadata-tag">{audioHealth}</span>}
                    <span className={`clip-status-dot ${clip.status}`} />
                </div>
            </div>

            {/* Waveform Sparkline */}
            {clip.audio_envelope && (
                <Waveform
                    envelope={clip.audio_envelope}
                />
            )}

            <div className="clip-metadata">
                <MetaItem label="RES" value={clip.width > 0 ? `${clip.width}×${clip.height}` : "—"} />
                <MetaItem label="FPS" value={clip.fps > 0 ? `${clip.fps}` : "—"} />
                <MetaItem label="SIZE" value={formatFileSize(clip.size_bytes)} />
                <MetaItem label="AUDIO" value={clip.audio_codec !== "none" ? `${clip.audio_codec.toUpperCase()} ${clip.audio_channels}ch ${clip.audio_sample_rate / 1000}kHz` : "No Audio"} />
                <MetaItem label="TC" value={clip.timecode || "—"} />
                <MetaItem label="ISO" value={clip.camera_iso || "—"} />
                <MetaItem label="WB" value={clip.camera_white_balance || "—"} />
            </div>

            <div className="clip-lookbook-taxonomy">
                <label className="clip-taxonomy-field">
                    <span className="meta-label">Shot Size</span>
                    <input
                        list="shot-size-options"
                        className="input-text"
                        value={localShotSize}
                        placeholder="Type to search"
                        onChange={(e) => setLocalShotSize(e.target.value)}
                        onBlur={handleShotSizeBlur}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleShotSizeBlur(); }}
                    />
                </label>
                <label className="clip-taxonomy-field">
                    <span className="meta-label">Movement</span>
                    <input
                        list="movement-options"
                        className="input-text"
                        value={localMovement}
                        placeholder="Type to search"
                        onChange={(e) => setLocalMovement(e.target.value)}
                        onBlur={handleMovementBlur}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleMovementBlur(); }}
                    />
                </label>
                <label className="clip-taxonomy-field clip-taxonomy-order">
                    <span className="meta-label">Manual Order</span>
                    <input
                        type="number"
                        className="input-text"
                        value={localManualOrder}
                        onChange={(e) => setLocalManualOrder(Number(e.target.value || 0))}
                        onBlur={handleManualOrderBlur}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleManualOrderBlur(); }}
                        min={0}
                        disabled={lookbookSortMode !== "custom"}
                    />
                </label>
            </div>

            <div className="clip-metadata-compact" style={{ padding: "0 12px 12px" }}>
                {clip.auto_motion && <span className="metadata-tag">Auto: {clip.auto_motion}</span>}
                {clip.auto_brightness && <span className="metadata-tag">Auto: {clip.auto_brightness}</span>}
                {clip.auto_contrast && <span className="metadata-tag">Auto: {clip.auto_contrast}</span>}
                {clip.auto_temp && <span className="metadata-tag">Auto: {clip.auto_temp}</span>}
            </div>
        </div>
    );
}

function MetaItem({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
    return (
        <div className="meta-item" data-tooltip={tooltip}>
            <span className="meta-label">{label}</span>
            <span className="meta-value">{value}</span>
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    if (i < 0) return "0 B";
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatDuration(ms: number): string {
    if (ms === 0) return "—";
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getAudioHealth(summary: string | undefined, envelope?: number[]): string | null {
    if (!summary || summary.toLowerCase().includes("no audio")) return "NO AUDIO";
    if (!envelope || envelope.length === 0) return "AUDIO";
    const peak = Math.max(...envelope);
    const silentRatio = envelope.filter((v) => v < 20).length / envelope.length;
    if (peak >= 245) return "POSSIBLE CLIP";
    if (silentRatio > 0.85) return "VERY LOW";
    return "AUDIO OK";
}
