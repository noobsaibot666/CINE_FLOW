---
title: Media Processing
description: Media processing and Camera Match Lab pipeline behavior.
---

# Media Processing

CineFlow media operations are deterministic and should avoid blocking the UI.

## Pipeline

1. Accept input clip or image.
2. Generate a proxy when required.
3. Extract representative frames.
4. Calculate metrics.
5. Compare analysis results.
6. Suggest adjustments or produce exports.
7. Save run or report data.

## BRAW Handling

Blackmagic RAW files require a decode path:

1. Detect `.braw`.
2. Use BRAW decode tooling.
3. Pipe raw frames through FFmpeg.
4. Produce a temporary proxy.
5. Run analysis on the proxy.

Fallback options include software decode, MP4 override proxies, and frame extraction fallback paths.

## Background Jobs

Media operations should run through background job surfaces and complete as either `done` or `failed`. They must never hang indefinitely.

