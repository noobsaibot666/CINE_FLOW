---
title: V1.1 ACES/OCIO Roadmap
description: Phase-by-phase roadmap for the CineFlow V1.1 Production color pipeline.
---

# V1.1 ACES/OCIO Roadmap

CineFlow V1.1 will improve Look Setup, Camera Match Lab, and Match & Normalize by moving production analysis into a traceable ACES/OCIO workflow.

The target pipeline is:

```text
camera source -> decode or proxy -> source profile -> ACES transform -> analysis -> match recommendation -> report/LUT/CDL
```

## Core Principle

ACES and OCIO make color analysis more trustworthy after the app has decoded pixels and identified the source color space. They do not remove the need for vendor decoders or proxies for proprietary RAW formats.

CineFlow will make that distinction visible in the UI:

- Original file analyzed directly
- Vendor decoder used
- Camera proxy used
- Operator proxy used
- Original unsupported without proxy

## Phase 1: Media Capability Detection

Status: Planned

Build a shared capability layer that classifies selected camera media before analysis.

The app will detect:

- container and codec
- bit depth
- color transfer
- color primaries
- color range
- source format family
- direct decode support
- proxy or vendor decoder requirement

This phase gives users clear answers before they spend time analyzing a clip.

## Phase 2: Source Profiles and ACES Transform Metadata

Status: Planned

Add production source profiles for common cinema workflows:

- Sony S-Log3 / S-Gamut3.Cine
- Canon C-Log2 and C-Log3 / Cinema Gamut
- ARRI LogC3 and LogC4
- RED Log3G10 / REDWideGamutRGB
- Blackmagic Film Gen 5 / Wide Gamut Gen 5
- Panasonic V-Log / V-Gamut
- Fujifilm F-Log2 / F-Gamut
- Nikon N-Log
- Rec.709, HLG, and PQ

The first implementation will record transform intent and provenance. OpenColorIO execution can then become the transform engine as the integration hardens.

## Phase 3: Camera Match Lab Trust Layer

Status: Planned

Camera Match Lab becomes the source of truth for measured production matching.

Each analysis run will record:

- source path
- original format
- analysis source type
- source profile
- ACES analysis space
- decode path
- frame count
- chart quality
- warnings
- confidence score

This makes the report useful in real production conversations because the app can explain how it reached each recommendation.

## Phase 4: Match & Normalize Upgrade

Status: Planned

Match & Normalize will consume saved Camera Match Lab runs instead of relying only on setup checklists.

The upgraded feature will produce:

- hero camera baseline
- measured exposure offsets
- white balance and tint bias
- chart-based transform suggestions
- LUT/CDL export when supported
- confidence-scored recommendations
- proxy/vendor-decoder warnings

When no analysis run exists, the module can still produce a setup-based checklist, but it will label the output as guidance rather than measured normalization.

## Phase 5: RAW Workflow Expansion

Status: Planned

The V1.1 RAW strategy is practical and honest:

- Blackmagic RAW: continue vendor-backed BRAW bridge support.
- RED R3D and Nikon N-RAW: formalize REDline capability probing and decode/proxy paths.
- Canon Cinema RAW Light: guide users to Canon Cinema RAW Development or NLE proxy export.
- Sony X-OCN: guide users to Sony Catalyst, Resolve, or NLE proxy export.
- ProRes RAW: require proxy workflow until a clean direct decode path is confirmed.

The app should never imply a proprietary RAW file was directly decoded when analysis actually used a proxy.

## Phase 6: Documentation During Development

Status: Planned

This page will be updated as development progresses. The engineering design and implementation plan live in:

- `docs/superpowers/specs/2026-08-13-aces-ocio-production-v11-design.md`
- `docs/superpowers/plans/2026-08-13-aces-ocio-production-v11.md`

## Success Criteria

V1.1 is successful when:

- Look Setup displays source-profile assumptions clearly.
- Camera Match Lab reports the exact analysis path for each slot.
- Match & Normalize uses measured analysis when available.
- Proxy-based workflows are labeled honestly.
- Exports include confidence and provenance.
- The app can explain why a recommendation should be trusted.

## References

- [ACES](https://github.com/aces-aswf/aces)
- [ACESCentral](https://acescentral.com/)
- [ACES Input Transforms](https://docs.acescentral.com/system-components/input-transforms/)
- [OpenColorIO](https://github.com/AcademySoftwareFoundation/OpenColorIO)
- [Blackmagic RAW SDK](https://www.blackmagicdesign.com/developer/products/braw/overview)
- [RED R3D SDK](https://www.reddigitalcinema.com/download/r3d-sdk)
- [Canon Cinema RAW Development](https://app.ssw.imaging-saas.canon/app/en/crd.html)
- [Sony Catalyst supported formats](https://helpguide.sony.net/di-app/cb/v1/en/Content/Supported_video_formats.htm)

