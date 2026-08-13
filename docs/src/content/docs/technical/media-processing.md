---
title: Media Processing
description: Media processing and Camera Match Lab pipeline behavior.
---

# Media Processing

CineFlow media operations are deterministic and should avoid blocking the UI.

## Pipeline

1. Accept input clip or image.
2. Classify the source as original, vendor-decoded, operator proxy, proxy required, or unsupported.
3. Generate or attach a proxy when required.
4. Extract representative frames.
5. Calculate metrics and source capability metadata.
6. Compare analysis results.
7. Suggest adjustments or produce exports.
8. Save run provenance and report data.

## Capability and Provenance

Camera Match Lab stores a capability report with saved analysis runs. The report tracks the original source path, format family, decode path kind, proxy requirement, recommended proxy tool when relevant, and warnings.

Saved results can also include source profile, analysis color space, decode path, and a 0-100 confidence score. Older saved runs remain readable when these fields are absent.

## BRAW Handling

Blackmagic RAW files require a decode path:

1. Detect `.braw`.
2. Use BRAW decode tooling.
3. Pipe raw frames through FFmpeg.
4. Produce a temporary proxy.
5. Run analysis on the proxy.

Fallback options include software decode, MP4 override proxies, and frame extraction fallback paths.

## Confidence Labels

Match confidence is reported on a 0-100 scale:

- `85-100`: high
- `65-84`: usable
- `40-64`: caution
- `0-39`: low trust

Confidence decreases when analysis depends on operator proxies, unsupported originals, missing source profiles, failed chart detection, clipped patches, or too few analyzed frames.

## Background Jobs

Media operations should run through background job surfaces and complete as either `done` or `failed`. They must never hang indefinitely.
