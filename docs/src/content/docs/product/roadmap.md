---
title: Roadmap
description: Current CineFlow Suite roadmap by production phase.
---

# Roadmap

## Current Release Scope

CineFlow Suite 1.x focuses on local-first production workflows across macOS and Windows:

- Pre-production folder setup, references, shot lists, and camera starter sheets
- Production project management, look setup, camera matching, on-set coaching, evidence-backed normalization, and frame preview
- Post-production contact sheets, scene organization, safe copy verification, review notes, and export packaging

## Recent Production Workflow Improvements

- Camera Match Lab labels original, vendor-decoded, operator-proxy, and proxy-required analysis paths.
- Camera Match Lab records source profile, ACES analysis intent, OCIO config status, transform status, proxy validation, metric trust, decode path, capability report data, and confidence.
- Camera Match Lab validates proxy-backed RAW analysis using duration/frame-count estimates when available, resolution, codec, source pairing, and color pipeline notes.
- Match & Normalize can use saved Match Lab runs to build measured normalization steps and exports with confidence, trust labels, provenance reasons, and evidence.

## Near-Term Priorities

- Link and package native OCIO processing so configured transforms can move from metadata/provenance reporting to executed pixel transforms.
- Continue the LibRaw adapter work for supported open camera RAW formats while keeping proprietary vendor RAW behind legal vendor SDK/tool boundaries.
- Harden media import and fallback handling across MP4, MOV, BRAW, and vendor/proxy RAW workflows.
- Keep export branding consistent across PDF, image, CSV, and review handoff outputs
- Improve Windows packaging and Microsoft Store submission readiness
- Continue tightening App Store compliance, privacy documentation, and sandbox behavior

## Longer-Term Direction

- More camera profile presets for production starter sheets
- Richer match reports for DIT and color workflows
- More structured editorial handoff formats
- Better project templates for commercial, documentary, BTS, and social-first productions
