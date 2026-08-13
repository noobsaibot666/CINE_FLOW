# CineFlow V1.1 ACES/OCIO Production Pipeline Design

## Purpose

CineFlow V1.1 will make Production tools more reliable for professional camera matching by moving analysis into a traceable ACES/OCIO pipeline. The goal is not to pretend CineFlow can decode every proprietary RAW file directly. The goal is to make every analysis path explicit, convert supported sources into a common color-managed space, and make Match & Normalize a source-backed decision tool.

## Core Decision

Use ACES and OpenColorIO as the color-management backbone for Look Setup, Camera Match Lab, and Match & Normalize.

The working model is:

```text
camera source -> decode/proxy -> source profile -> ACES transform -> analysis -> match recommendation -> report/LUT/CDL
```

ACES handles color normalization once pixels are decoded and the source color space is known. It does not replace vendor RAW SDKs. Proprietary RAW formats still require one of these paths:

- Direct vendor-backed decode when available and legally compatible.
- Operator-selected proxy generated from the vendor tool.
- Existing camera proxy media from the card structure.
- Manual source profile selection when metadata is missing.

## Scope

V1.1 focuses on Production:

- `Look Setup`
- `Camera Match Lab`
- `Match & Normalize`
- shared media capability detection
- shared camera/source profile data
- public documentation

Post-production review, Safe Copy, and licensing are out of scope unless they consume shared metadata already produced by the Production media pipeline.

## Architecture

### Media Capability Layer

Create a backend capability layer that answers:

- Can CineFlow read this original file directly?
- Is the source a proprietary RAW file that needs a vendor bridge or proxy?
- What codec, bit depth, range, transfer, primaries, resolution, and frame rate were detected?
- Which source profile should be used for color conversion?
- How trustworthy is the analysis path?

The layer should classify sources into:

- `direct_original`: FFmpeg can extract frames from the original file.
- `vendor_decoded`: CineFlow used a vendor bridge such as BRAW bridge or REDline.
- `operator_proxy`: user selected an MP4, MOV, ProRes, or similar proxy.
- `camera_proxy`: CineFlow discovered a proxy beside the original media.
- `unsupported_original`: CineFlow can identify the format but cannot decode it safely.

### ACES Transform Layer

The transform layer maps camera/log profiles to ACES analysis space. V1.1 should start with profile definitions and a deterministic transform registry, then integrate OpenColorIO execution.

Initial profile groups:

- Sony S-Log3 / S-Gamut3.Cine
- Sony S-Log3 / S-Gamut3
- Canon C-Log2 / Cinema Gamut
- Canon C-Log3 / Cinema Gamut
- ARRI LogC3 / Wide Gamut
- ARRI LogC4 / Wide Gamut 4
- RED Log3G10 / REDWideGamutRGB
- Blackmagic Film Gen 5 / Wide Gamut Gen 5
- Panasonic V-Log / V-Gamut
- Fujifilm F-Log2 / F-Gamut
- Nikon N-Log
- Rec.709
- HLG / Rec.2020
- PQ / Rec.2020

### Analysis Space

Use ACEScct as the default analysis working space for UI-facing comparisons because it maps better to colorist language and grading-style operations. Preserve traceability to ACES2065-1/AP0 where needed for exchange and documentation.

Metrics should record:

- source profile
- transform profile
- analysis color space
- decode path
- source bit depth
- source range
- chart quality
- confidence score
- warning messages

### Look Setup

Look Setup should evolve from rule-based setup guidance into profile-aware setup guidance:

- camera model selection chooses a default source profile
- mode selection includes codec/log/RAW expectations
- missing metadata warnings are visible before analysis
- profile notes explain when a proxy is required
- generated outputs include ACES/source-profile assumptions

### Camera Match Lab

Camera Match Lab should become the authoritative measurement source:

- ingest source files or proxies per slot
- detect file capability before analysis
- run original/proxy/vendor decode
- convert sampled frames into the selected ACES analysis space
- calculate luma, RGB, skin, neutral patch, and chart metrics in that space
- generate transform previews and LUT/CDL exports with provenance

### Match & Normalize

Match & Normalize should stop being only a checklist generator. It should consume saved Match Lab runs and produce a confidence-scored normalization package:

- hero camera baseline
- per-camera exposure offset
- white balance/tint bias
- color matrix or LUT suggestion when chart data is available
- per-source reliability label
- warnings when the result is proxy-based or missing metadata
- exportable report and LUT/CDL package

## RAW Strategy

### Direct or Vendor-Backed

- BRAW: continue BRAW bridge work and expose it as a first-class decode capability.
- RED R3D / Nikon N-RAW: formalize REDline probing and support where the installed bundled tool can decode.

### Proxy-Guided

- Canon Cinema RAW Light / CRM / RMF: guide the user to Canon Cinema RAW Development or NLE export, then ingest the proxy.
- Sony X-OCN: guide the user to Sony Catalyst Browse/Prepare, Resolve, or NLE proxy/export, then ingest the proxy.
- ProRes RAW: treat as proxy-required unless a legally clean decode path is confirmed.

## Data Model

Add persistent records for:

- media capability report per source
- source profile selection
- transform profile
- analysis confidence
- decode path
- proxy relationship
- ACES analysis version

Existing Match Lab run records should be extended rather than replaced, so older saved runs remain readable.

## UI Principles

The UI must make trust visible:

- show whether analysis used original, vendor decode, camera proxy, or operator proxy
- show the source profile used
- show ACES transform path
- show confidence and warnings before exporting recommendations
- never imply unsupported proprietary RAW was truly decoded when it was proxy-based

## Documentation

Add public Astro documentation for the V1.1 ACES/OCIO roadmap. Keep the implementation plan in `docs/superpowers/plans` and update it phase by phase during development.

## External References

- ACES: https://github.com/aces-aswf/aces
- ACESCentral: https://acescentral.com/
- ACES Input Transforms: https://docs.acescentral.com/system-components/input-transforms/
- OpenColorIO: https://github.com/AcademySoftwareFoundation/OpenColorIO
- OpenImageIO: https://github.com/AcademySoftwareFoundation/OpenImageIO
- FFmpeg docs: https://ffmpeg.org/ffmpeg.html
- Blackmagic RAW SDK: https://www.blackmagicdesign.com/developer/products/braw/overview
- RED R3D SDK: https://www.reddigitalcinema.com/download/r3d-sdk
- Canon Cinema RAW Development: https://app.ssw.imaging-saas.canon/app/en/crd.html
- Sony Catalyst supported formats: https://helpguide.sony.net/di-app/cb/v1/en/Content/Supported_video_formats.htm

