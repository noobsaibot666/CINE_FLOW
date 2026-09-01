---
title: Roadmap
description: Current CineFlow Suite roadmap by production phase.
---

# Roadmap

## Current Release Scope

CineFlow Suite 1.x focuses on local-first production workflows across macOS and Windows:

- Pre-production verified media offload, folder setup, reference boards, shot lists, and camera starter sheets
- Production project management, look setup, camera matching, on-set coaching, evidence-backed normalization, and frame preview
- Post-production media review, contact sheets, scene organization, review notes, and export packaging

## Recent Improvements

- **Safe Copy** moved into Pre-Production so verified offload runs before editorial, not after.
- **Duplicate Finder** gained scan options (minimum size, hidden files, extension and folder filters), a bulk-cleanup workflow with keep-newest / keep-oldest / keep-shortest-path selection and a verified move-to-Trash, cancellable scans, and faster handling of large libraries and network drives.
- The reference tool is now the **Reference Board**, with grid-mosaic contact walls exported directly from the same view (frames per clip, sequential or shuffled, square or original cells).
- **Camera Match Lab** camera database expanded to current cinema and hybrid bodies across eight manufacturers, with correct base ISO and log/gamut pairing per body; skin-tone sampling and the confidence score were tightened for more trustworthy results.
- **Cinema RAW decode** for analysis: BRAW and Apple ProRes RAW decode directly; R3D, R3D NE, and Nikon N-RAW decode through an installed RED SDK / REDline; Canon Cinema RAW Light, Sony X-OCN, and ARRIRAW decode through DaVinci Resolve. A Decoder Setup panel reports readiness, links the free downloads, and lets you point the app at existing installs, with an explicit "Generate proxy" step and a proxy fallback so analysis never stalls.
- **Look Setup** notes now open in a roomy editor saved with the project, and the results section is an on-set playbook with a readiness checklist. **On-Set Coach** and **Match & Normalize** were restructured into clear, numbered workflows.
- **Frame Preview** accepts drag-and-drop media anywhere on the window and gives the working canvas more room.
- **Contact sheets** render in a clean black-and-white layout. **FCPXML timeline export** now imports cleanly into Final Cut Pro and DaVinci Resolve, with encoded media links and standard broadcast timebases.

## Near-Term Priorities

- Link and package native OCIO processing so configured transforms can move from metadata/provenance reporting to executed pixel transforms.
- Native RED and DaVinci Resolve decode paths that need no separate install.
- Continue the LibRaw adapter work for supported open camera RAW formats.
- Harden media import and fallback handling across MP4, MOV, BRAW, and vendor/proxy RAW workflows.
- Keep export branding consistent across PDF, image, and review handoff outputs.
- Improve Windows packaging and Microsoft Store submission readiness.
- Continue tightening App Store compliance, privacy documentation, and sandbox behavior.

## Longer-Term Direction

- More camera profile presets for production starter sheets
- Richer match reports for DIT and color workflows
- More structured editorial handoff formats
- Better project templates for commercial, documentary, BTS, and social-first productions
