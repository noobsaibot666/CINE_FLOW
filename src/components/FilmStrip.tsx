import { Thumbnail } from "../types";

interface FilmStripProps {
    clipId: string;
    thumbnails: Thumbnail[];
    thumbnailCache: Record<string, string>;
    status: string;
    count: number;
    aspectRatio?: number;
    isExtracting?: boolean;
    onDoubleClick?: () => void;
}

export function FilmStrip({ clipId, thumbnails, thumbnailCache, status, count, aspectRatio = 16 / 9, isExtracting = false, onDoubleClick }: FilmStripProps) {
    const indices = Array.from({ length: count }, (_, i) => i);
    const orientationClass = aspectRatio > 0 && aspectRatio < 1 ? "is-vertical" : "is-horizontal";

    if (status === "fail") {
        return (
            <div className={`film-strip ${orientationClass}`} onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}>
                {indices.map((i) => (
                    <div key={i} className="film-strip-placeholder">
                        {i === Math.floor(count / 2) ? "Failed" : ""}
                    </div>
                ))}
            </div>
        );
    }

    if (thumbnails.length === 0) {
        return (
            <div className={`film-strip ${orientationClass}`} onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}>
                {indices.map((i) => (
                    <div key={i} className="film-strip-placeholder">
                        {i === Math.floor(count / 2) && (
                            isExtracting
                                ? <span className="spinner" style={{ width: 16, height: 16 }} />
                                : <span className="thumb-warning">No thumbnails</span>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`film-strip ${orientationClass}`} onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}>
            {indices.map((idx) => {
                const thumb = thumbnails.find((t) => t.index === idx);
                const cacheKey = `${clipId}_${idx}`;
                const src = thumbnailCache[cacheKey];

                if (src) {
                    return (
                        <div key={idx} className="film-strip-thumb">
                            <img src={src} alt={`Frame ${idx + 1}`} />
                            <span className="thumb-time">
                                {formatTimestamp(thumb?.timestamp_ms || 0)}
                            </span>
                        </div>
                    );
                }

                return (
                    <div key={idx} className="film-strip-placeholder">
                        {isExtracting
                            ? <span className="spinner" style={{ width: 12, height: 12 }} />
                            : <span className="thumb-warning">—</span>}
                    </div>
                );
            })}
        </div>
    );
}

function formatTimestamp(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}
