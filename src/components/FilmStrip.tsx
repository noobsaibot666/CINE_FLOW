import { Thumbnail } from "../types";

interface FilmStripProps {
    clipId: string;
    thumbnails: Thumbnail[];
    thumbnailCache: Record<string, string>;
    status: string;
    count: number;
    aspectRatio?: number;
    onDoubleClick?: () => void;
    projectLutHash?: string | null;
    clipLutEnabled?: number;
    lutRenderNonce?: number;
}

export function FilmStrip({ clipId, thumbnails, thumbnailCache, status, count, aspectRatio = 16 / 9, onDoubleClick, projectLutHash, clipLutEnabled = 0, lutRenderNonce = 0 }: FilmStripProps) {
    const indices = Array.from({ length: count }, (_, i) => i);
    const orientationClass = aspectRatio > 0 && aspectRatio < 1 ? "is-vertical" : "is-horizontal";

    if (status === "fail") {
        return (
            <div
                className={`film-strip ${orientationClass}`}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
                style={{ "--aspect-ratio": aspectRatio } as any}
            >
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
            <div
                className={`film-strip ${orientationClass}`}
                onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
                style={{ "--aspect-ratio": aspectRatio } as any}
            >
                {indices.map((i) => (
                    <div key={i} className="film-strip-placeholder">
                        {i === Math.floor(count / 2) && (
                            <span className="thumb-warning">No thumbnails</span>
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
            style={{ "--aspect-ratio": aspectRatio } as any}
        >
            {indices.map((idx) => {
                const thumb = thumbnails.find((t) => t.index === idx);
                const cacheKey = `${clipId}_${idx}`;
                let src = thumbnailCache[cacheKey];

                if (src && projectLutHash && clipLutEnabled === 1) {
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
                                if (projectLutHash && clipLutEnabled === 1) {
                                    (e.target as HTMLImageElement).src = thumbnailCache[cacheKey];
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
                        <span className="thumb-warning">—</span>
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
