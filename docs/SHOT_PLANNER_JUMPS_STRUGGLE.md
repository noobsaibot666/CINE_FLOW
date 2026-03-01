# Shot Planner Jumps: Failure Notes

## Summary

Shot Planner `Jumps` became a high-friction failure area during dev work. Changing the jump interval, especially from `2s` to `4s`, repeatedly caused:

- UI freezes
- repeated thumbnail regeneration loops
- stale thumbnail paths
- large console warning floods
- broken image previews
- magenta/pink thumbnail artifacts

This note records what went wrong and what was changed.

## Symptoms Seen

- Changing `Jumps` did not reliably change the thumbnails shown.
- The app could get stuck while regenerating thumbnails.
- Console filled with `404` thumbnail errors from paths under `wrap-preview-dev/cache/...`.
- Console filled with `[TAURI] Couldn't find callback id ...` warnings during dev reloads.
- Thumbnail hydration sometimes logged warnings even when the thumbnail was already loaded as a `data:` URL.
- In the worst state, Shot Planner rendered large pink image artifacts and became effectively unusable.

## Main Root Causes

### 1. Cache path did not include sampling config

Thumbnail extraction originally reused the same cache folder per clip:

- `cache/<clip_id>/thumb_0.jpg`
- `cache/<clip_id>/thumb_1.jpg`

That meant changing `Jumps` or thumb count could still point to old files or partial files.

### 2. Frontend and backend cache identity drifted

The frontend started using contextual cache keys like:

- `clipId_index|jump=4|density=7|gen=...`

But the backend file layout and DB rows were still effectively clip-only unless explicitly refreshed.

### 3. Too much work happened on every jump change

Changing `Jumps` triggered a heavy path:

- clear visible thumbnail cache
- update clip metadata for all clips
- trigger thumbnail extraction
- rehydrate thumbnails on progress events
- rerender filmstrip rows repeatedly

This was too expensive and caused freezes.

### 4. Progress events were too heavy

Each `thumbnail-progress` event tried to hydrate thumbnail image data immediately. On larger folders that created a large amount of concurrent image reads and React state churn.

### 5. FilmStrip LUT path rewriting was invalid for `data:` URLs

Once thumbnails were hydrated as base64 `data:` URLs, the filmstrip LUT rewrite logic still tried to rewrite them like filesystem paths. That could produce invalid image sources and likely contributed to the pink/magenta artifact state.

### 6. Tauri dev reload warnings came from long-lived command callbacks

`extract_thumbnails` originally awaited the full extraction lifecycle before returning. On dev reload, Tauri would complain that the callback id no longer existed.

## Fixes Applied

### Backend

- Thumbnail extraction cache folder now includes sampling config:
  - `cache/<clip_id>/jump_<seconds>_count_<count>/thumb_<n>.<ext>`
- Old thumbnail DB rows for a clip are deleted before regeneration.
- `read_thumbnail` now returns the correct MIME type for `png` and `jpg`.
- `extract_thumbnails` now accepts `jump_seconds` directly.
- `extract_thumbnails` was changed to return its job id immediately and continue work in a background task.

### Frontend

- Thumbnail hydration moved away from `convertFileSrc(...)` to `read_thumbnail` data URLs for Shot Planner cache usage.
- Missing thumbnail files are treated as silent misses instead of flooding warnings.
- Existing `data:` thumbnails are no longer re-hydrated.
- Dev-only console filter suppresses only the specific Tauri callback-id warning.
- Jump changes no longer write updated jump metadata to every clip before extraction.
- Jump changes do not start a new extraction while one is already running.
- Thumbnail progress events no longer rehydrate thumbnails immediately clip-by-clip; cache hydration is deferred to completion refresh.
- FilmStrip now skips LUT filename rewriting for `data:` URLs.

## Current Safer Behavior

The current intended flow is:

1. User changes `Jumps`.
2. Shot Planner clears in-memory thumbnail entries for visible clips.
3. Shot Planner triggers one background extraction job with `jumpSeconds` and `thumbCount`.
4. Progress updates only update clip progress state.
5. On completion, clips are refreshed and thumbnails are hydrated once.

## Known Residual Risk

If Shot Planner still freezes after these fixes, the next likely pressure point is extraction throughput itself:

- clip concurrency may still be too high for some media sets
- large base64 hydration batches may still be expensive on very large folders
- exotic codecs or partially decodable sources may still generate malformed thumbnails

If that happens, next mitigation should be:

- reduce extraction concurrency
- batch completion hydration
- add stronger thumbnail decode validation before cache insert

## Files Most Involved

- `src/App.tsx`
- `src/components/FilmStrip.tsx`
- `src/components/ClipList.tsx`
- `src/utils/ExportUtils.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/db.rs`
- `src-tauri/src/thumbnail.rs`

## Practical Lesson

`Jumps` is not a cosmetic UI control. It changes the thumbnail sampling contract. That means it must be part of:

- backend extraction inputs
- cache identity
- DB thumbnail validity
- frontend cache identity
- export thumbnail lookup

Treating it as only a UI preference caused most of the instability.
