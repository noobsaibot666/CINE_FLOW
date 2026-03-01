import { memo } from "react";
import { Thumbnail } from "../types";
import { DisplayedThumbnail, getThumbnailCacheValue } from "../utils/shotPlannerThumbnails";

interface FilmStripProps {
    clipId?: string;
    thumbnails: DisplayedThumbnail[] | Thumbnail[];
    thumbnailCache?: Record<string, string>;
    status: string;
    placeholderCount?: number;
    count?: number;
    cacheKeyContext?: string;
    aspectRatio?: number;
    onDoubleClick?: () => void;
    projectLutHash?: string | null;
    clipLutEnabled?: number;
    lutRenderNonce?: number;
    fallbackThumbnailSrc?: string;
}

export const FilmStrip = memo(function FilmStrip({
    clipId,
    thumbnails,
    thumbnailCache = {},
    status,
    placeholderCount = 1,
    count,
    cacheKeyContext,
    aspectRatio = 16 / 9,
    onDoubleClick,
    projectLutHash,
    clipLutEnabled = 0,
    lutRenderNonce = 0,
    fallbackThumbnailSrc
}: FilmStripProps) {

    const effectivePlaceholderCount = count ?? placeholderCount;
    const indices = Array.from({ length: effectivePlaceholderCount }, (_, i) => i);
    const orientationClass = aspectRatio > 0 && aspectRatio < 1 ? "is-vertical" : "is-horizontal";
    const resolvedThumbnails: DisplayedThumbnail[] = thumbnails.map((thumb) => {
        if ("src" in thumb) {
            return thumb;
        }
        return {
            index: thumb.index,
            timestamp_ms: thumb.timestamp_ms,
            src: clipId ? (getThumbnailCacheValue(thumbnailCache, clipId, thumb.index, cacheKeyContext) ?? "") : "",
        };
    }).filter((thumb) => Boolean(thumb.src));

    if (status === "fail") {
        return (
            <div
                className={`film-strip ${orientationClass}`}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
                style={{ "--aspect-ratio": aspectRatio } as any}
            >
                {indices.map((i) => (
                    <div key={i} className="film-strip-placeholder">
                        {i === Math.floor(effectivePlaceholderCount / 2) ? "Failed" : ""}
                    </div>
                ))}
            </div>
        );
    }

    if (resolvedThumbnails.length === 0) {
        return (
            <div
                className={`film-strip ${orientationClass}`}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
                style={{ "--aspect-ratio": aspectRatio, "--thumb-columns": effectivePlaceholderCount } as any}
            >
                {indices.map((idx) => (
                    <div key={idx} className="film-strip-placeholder">
                        {idx === Math.floor(effectivePlaceholderCount / 2) ? (
                            <span className="thumb-warning">No thumbnails</span>
                        ) : (
                            <span className="thumb-warning">—</span>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div
            className={`film-strip ${orientationClass}`}
            onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
            style={{ "--aspect-ratio": aspectRatio, "--thumb-columns": effectivePlaceholderCount } as any}
        >
            {indices.map((idx) => {
                const thumb = resolvedThumbnails[idx];
                let src = thumb?.src;

                if (src && !src.startsWith("data:") && projectLutHash && clipLutEnabled === 1) {
                    const [baseSrc] = src.split("?");
                    const parts = baseSrc.split('/');
                    const filename = parts.pop();
                    const newFilename = `lut_${projectLutHash}_${filename}`;
                    src = `${[...parts, newFilename].join('/')}?lutv=${lutRenderNonce}`;
                }

                if (src) {
                    return (
                        <div key={idx} className="film-strip-thumb">
                            <img src={src} alt={`Frame ${idx + 1}`} onError={(e) => {
                                // Fallback to original thumbnail if LUT image fails to load
                                if (thumb && projectLutHash && clipLutEnabled === 1) {
                                    (e.target as HTMLImageElement).src = fallbackThumbnailSrc ?? thumb.src;
                                }
                            }} />
                            <span className="thumb-time">
                                {formatTimestamp(thumb?.timestamp_ms || 0)}
                            </span>
                        </div>
                    );
                }

                return (
                    <div key={idx} className="film-strip-placeholder">
                        {resolvedThumbnails.length === 0 && idx === Math.floor(effectivePlaceholderCount / 2) ? (
                            <span className="thumb-warning">No thumbnails</span>
                        ) : (
                            <span className="thumb-warning">—</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

function formatTimestamp(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}
