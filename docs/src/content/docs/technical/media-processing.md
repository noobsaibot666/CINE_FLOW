---
title: Media Processing
description: Media processing and Camera Match Lab pipeline behavior.
---

# Media Processing

CineFlow media operations are deterministic and should avoid blocking the UI.

## Pipeline

1. Accept input clip or image.
2. Classify the source as original, decoded RAW, operator proxy, proxy required, or unsupported.
3. Capture the selected source profile and ACES analysis intent.
4. Check OCIO configuration status.
5. Generate or attach a proxy when required, using the decode provider for the format (see below).
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
- `transform_failed`: frame transform execution was attempted, but at least one analysis frame failed to transform.
- `config_missing`: an OCIO config path is configured but unavailable.
- `unsupported_transform`: no registered transform metadata exists for the selected source profile.

Metrics are marked trusted only when decode and transform execution both pass. Metadata-only and processor-missing paths remain usable for review, but they are treated as provisional.

Saved Match Lab analyses now persist decode and transform provenance alongside metrics:

- `decode_path_kind`: the analysis-time decode path, such as direct original, vendor decode, native candidate, or operator proxy.
- `decode_source_path`: the file that actually supplied analysis frames.
- `transform_path_kind`: the transform state that produced the measured frames, such as OCIO frame transform or metadata-only.
- `ocio_processor_path`: the processor executable used when a frame transform was attempted.
- `trust_fallback_reason`: the explicit reason metrics stayed provisional.

The Camera Match Lab import UI shows these states separately: source decode path, OCIO config status, OCIO processor status, ACES path, metric trust, confidence, and the first blocker preventing trusted analysis.

## LibRaw Bridge Status

Open still/camera RAW formats such as DNG, ARW, CR2, CR3, NEF, RAF, RW2, ORF, SRW, RWL, and IIQ are routed through the LibRaw adapter contract.

The runtime bridge is discovered from `CINEFLOW_LIBRAW_BRIDGE`. Current LibRaw states include:

- `adapter_disabled`: the build has no LibRaw feature and no runtime bridge is configured.
- `bridge_missing`: `CINEFLOW_LIBRAW_BRIDGE` is configured, but the executable/file is not available.
- `metadata_available`: the runtime bridge is available and can be used as a source of RAW metadata.
- `frame_decode_available`: the runtime bridge is available for decoded analysis frames; open RAW can move from native candidate to direct analysis.

## Cinema RAW Decode Providers

Each cinema RAW family is serviced by a decode provider that builds an analysis proxy:

- **BRAW** — the bundled Blackmagic RAW decode tooling.
- **R3D, R3D NE, Nikon N-RAW** — an installed RED SDK / REDline, when present.
- **Canon Cinema RAW Light, Sony X-OCN, ARRIRAW** — a running DaVinci Resolve, when present.
- **Apple ProRes RAW** — decoded directly.

The Decoder Setup panel reports each provider as available or needs-setup, links the official free downloads, and lets an operator point the app at an existing install (persisted locally). A provider-backed source is not decoded until the operator presses **Generate proxy**, which runs as a background job. An operator-selected MP4/MOV proxy is always available as a fallback, and a source with no ready provider is marked provisional rather than blocking the run. Preferred analysis proxy codecs are H.264, H.265/HEVC, ProRes, and DNxHR.

Open still/camera RAW formats stay on the LibRaw adapter path described above.

## RAW Proxy Validation

When Camera Match Lab analyzes RAW through a proxy, the app validates the proxy metadata and stores the report with the result. The validation can compare duration and frame-count estimates when the source metadata is available, records proxy resolution and codec, checks whether an operator-selected proxy filename appears paired with the RAW source, and stores the color pipeline note used for the analysis.

Proxy validation warnings do not always block analysis, but they lower confidence and are shown in Camera Match Lab and exports. Preferred analysis proxy codecs are H.264, H.265/HEVC, ProRes, and DNxHR.

## Confidence Labels

Match confidence is reported on a 0-100 scale:

- `85-100`: high
- `65-84`: usable
- `40-64`: caution
- `0-39`: low trust

Confidence decreases when analysis depends on operator proxies, unsupported originals, missing source profiles, metadata-only or missing OCIO transform execution, untrusted metrics, weak proxy validation, failed chart detection, clipped patches, or too few analyzed frames.

## Background Jobs

Media operations should run through background job surfaces and complete as either `done` or `failed`. They must never hang indefinitely.
