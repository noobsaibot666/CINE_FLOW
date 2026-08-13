---
title: Media Processing
description: Media processing and Camera Match Lab pipeline behavior.
---

# Media Processing

CineFlow media operations are deterministic and should avoid blocking the UI.

## Pipeline

1. Accept input clip or image.
2. Classify the source as original, vendor-decoded, operator proxy, proxy required, or unsupported.
3. Capture the selected source profile and ACES analysis intent.
4. Check OCIO configuration status.
5. Generate or attach a proxy when required.
6. Validate proxy metadata when analysis uses a proxy.
7. Extract representative frames.
8. Calculate metrics and source capability metadata.
9. Compare analysis results.
10. Suggest adjustments or produce exports.
11. Save run provenance and report data.

## Capability and Provenance

Camera Match Lab stores a capability report with saved analysis runs. The report tracks the original source path, format family, decode path kind, proxy requirement, recommended proxy tool when relevant, and warnings.

Saved results can also include source profile, analysis color space, transform status, transform engine, OCIO config source/path/status, proxy validation, metric trust, decode path, and a 0-100 confidence score. Older saved runs remain readable when these fields are absent.

## ACES and OCIO Status

Camera Match Lab records the intended ACES analysis path for each source profile. The current implementation reports OCIO readiness and transform provenance, but it does not claim native OCIO pixel processing unless a transform execution report marks the transform as applied.

OCIO config discovery uses the explicit `OCIO` environment path first. If `OCIO` is not set, CineFlow checks bundled app resources in this order: `ocio/config.ocio`, `aces/config.ocio`, then `config.ocio`. A broken explicit `OCIO` path is reported as `config_missing`; it does not silently fall back to a bundled config.

Current transform states include:

- `transform_applied`: OCIO pixel transform was executed and metrics can be trusted.
- `metadata_only`: source profile and ACES intent are known, but no OCIO config is configured.
- `processor_not_available`: an OCIO config is available, but no packaged or configured OCIO processor executable is available.
- `processor_ready`: an OCIO config and processor executable are available, but the current analysis has not yet recorded a successful frame transform.
- `config_missing`: an OCIO config path is configured but unavailable.
- `unsupported_transform`: no registered transform metadata exists for the selected source profile.

Metrics are marked trusted only when decode and transform execution both pass. Metadata-only and processor-missing paths remain usable for review, but they are treated as provisional.

## BRAW Handling

Blackmagic RAW files require a decode path:

1. Detect `.braw`.
2. Use BRAW decode tooling.
3. Pipe raw frames through FFmpeg.
4. Produce a temporary proxy.
5. Run analysis on the proxy.

Fallback options include software decode, MP4 override proxies, and frame extraction fallback paths.

## RAW Proxy Validation

When Camera Match Lab analyzes RAW through a proxy, the app validates the proxy metadata and stores the report with the result. The validation can compare duration and frame-count estimates when the source metadata is available, records proxy resolution and codec, checks whether an operator-selected proxy filename appears paired with the RAW source, and stores the color pipeline note used for the analysis.

Proxy validation warnings do not always block analysis, but they lower confidence and are shown in Camera Match Lab, Match & Normalize, and exports. Preferred analysis proxy codecs are H.264, H.265/HEVC, ProRes, and DNxHR.

## Confidence Labels

Match confidence is reported on a 0-100 scale:

- `85-100`: high
- `65-84`: usable
- `40-64`: caution
- `0-39`: low trust

Confidence decreases when analysis depends on operator proxies, unsupported originals, missing source profiles, metadata-only or missing OCIO transform execution, untrusted metrics, weak proxy validation, failed chart detection, clipped patches, or too few analyzed frames.

## Background Jobs

Media operations should run through background job surfaces and complete as either `done` or `failed`. They must never hang indefinitely.
