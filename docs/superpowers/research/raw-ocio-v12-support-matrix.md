# RAW/OCIO V1.2 Support Matrix

## Purpose

This document locks the first V1.2 implementation boundary for RAW ingest and OCIO analysis. It is internal planning documentation and must not be copied to Astro public docs until the related feature is production approved.

## Ship Strategy

CineFlow separates file access from color management:

- decode adapters read source pixels or metadata
- source profiles identify camera/log color space
- OCIO transforms normalized decoded pixels into an ACES analysis space
- analysis reports include the path used and confidence limits

OCIO does not decode camera RAW files. RAW decode requires an open decoder, vendor SDK, vendor CLI, or operator-created proxy.

## Dependency Decisions

| Area | V1.2 Decision | Packaging Tier | Notes |
| --- | --- | --- | --- |
| Open still/camera RAW | Prepare for LibRaw integration | native_candidate | Use for `.dng`, `.arw`, `.cr2`, `.cr3`, `.nef`, `.raf`, `.rw2`, `.orf`; license and binary packaging must be reviewed before embedding. |
| OCIO config/execution | Prepare backend command boundary first | native_candidate | CPU execution comes after report contract; config validation must be visible before transforms are trusted. |
| H.264/H.265/HEVC containers | Keep existing FFmpeg/proxy path | native | Direct analysis remains allowed when source profile is known or manually selected. |
| BRAW | Keep vendor-backed path | vendor | Formalize behind ingest adapter; do not claim native decode unless the bridge is available. |
| RED R3D / Nikon N-RAW | Vendor CLI or SDK path | vendor | REDline/SDK availability controls analysis confidence. |
| Sony X-OCN | Proxy-guided path | proxy | Use Catalyst/NLE exports until a legally clean decode path is approved. |
| Canon Cinema RAW Light | Proxy-guided path | proxy | Use Canon Cinema RAW Development/NLE export until a legally clean decode path is approved. |
| ProRes RAW | Proxy-required path | proxy | Treat as proxy-required unless Apple/legal decode path is approved. |
| Unknown extensions | Unsupported original | unsupported | Ask for a supported mezzanine/proxy. |

## Support Tiers

| Tier | Meaning | UI Promise |
| --- | --- | --- |
| native | CineFlow can analyze the original or prepared source directly with bundled capability. | Direct analysis available. |
| native_candidate | Architecture supports a native adapter, but dependency packaging is not shipped yet. | Planned native path; current build may need proxy/vendor workflow. |
| vendor | Requires an installed or bundled vendor SDK/CLI/bridge. | Vendor decode required before trusted analysis. |
| proxy | Requires operator-created proxy or vendor-generated transcode. | Proxy workflow required. |
| unsupported | No supported ingest path is known. | Import a supported proxy. |

## Phase 1 Acceptance

- every targeted camera/media family has a support tier
- proprietary cinema RAW limitations are explicit
- OCIO is documented as a transform layer, not a decoder
- public Astro docs remain untouched
