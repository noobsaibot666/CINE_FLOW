import { Thumbnail } from "../types";

export interface DisplayedThumbnail {
  index: number;
  timestamp_ms: number;
  src: string;
}

interface DisplayedThumbOptions {
  clipId: string;
  thumbnails: Thumbnail[];
  thumbnailCache: Record<string, string>;
  thumbCount: number;
  cacheKeyContext?: string;
}

export function getThumbnailCacheValue(
  thumbnailCache: Record<string, string>,
  clipId: string,
  index: number,
  cacheKeyContext?: string,
): string | undefined {
  if (cacheKeyContext) {
    return thumbnailCache[`${clipId}_${index}|${cacheKeyContext}`];
  }
  return thumbnailCache[`${clipId}_${index}`];
}


export function getDisplayedThumbsForClip({
  clipId,
  thumbnails,
  thumbnailCache,
  thumbCount,
  cacheKeyContext,
}: DisplayedThumbOptions): DisplayedThumbnail[] {
  const resolved = [...thumbnails]
    .sort((a, b) => a.index - b.index)
    .map((thumb) => {
      const src = getThumbnailCacheValue(thumbnailCache, clipId, thumb.index, cacheKeyContext);
      if (!src) return null;
      return {
        index: thumb.index,
        timestamp_ms: thumb.timestamp_ms,
        src,
      };
    })
    .filter((thumb): thumb is DisplayedThumbnail => Boolean(thumb));

  if (resolved.length === 0) return [];
  return resolved.slice(0, Math.max(1, thumbCount));
}
