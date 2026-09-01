---
title: Production
description: CineFlow Suite production tools and workflows.
---

# Production

The Production phase is project-based. Create a named project with project and client metadata, then keep look decisions, camera match runs, and coach settings persistent across sessions.

## Project Manager

Creates and reopens production projects. Each project stores look settings, camera match runs, and coach configuration independently.

Project Manager opens from the **Projects** entry in the header, which also shows the name of the project you have open. The first time you open the Production tab with no projects yet, the create-project dialog appears automatically. While you are working inside a project, a small pill in the corner keeps the open project visible.

## Starter Setup

Generates camera-specific technical setup sheets with safe starting values for format, frame rate, shutter angle, ISO, white balance, log profile, and camera notes. Use it to walk onto set with a defensible baseline for each body.

## Look Setup

Defines camera roles, target look parameters, color temperature, exposure offset, contrast, and LUT selection. The saved look setup feeds On-Set Coach and the Camera Match Lab match actions.

- **Notes** open in a full editing window, are saved with the project, and are there again the next time you open it.
- Every change auto-saves — target look, lighting, faces-first priority, and each camera's settings.
- The results section is an **on-set playbook**: numbered steps (exposure order → camera pairing → monitoring → per-camera targets) you tick off, each with its reasoning, followed by a **"You're ready when…"** checklist that gates the move to Camera Match Lab.

## Camera Match Lab

Imports test clips from multiple cameras, inspects representative frames, compares luma and RGB metrics, and generates per-camera normalization recommendations.

### Camera database

The camera list covers current cinema and hybrid bodies across ARRI, Sony, Canon, Panasonic, Nikon, RED, Blackmagic, and Fujifilm — including recent additions such as Sony BURANO and Venice 2, Canon C400 and C80, the Nikon ZR, RED KOMODO-X and V-RAPTOR variants, Blackmagic PYXIS and URSA Cine, and Fujifilm F-Log2 bodies. Each body carries its base ISO options and log/gamut pairing, so the analysis targets are correct for the camera you actually shot.

### Analysis

Each selected camera shows its analysis path, source profile state, ACES path status, confidence, and warnings. Analysis paths distinguish original media, decoded RAW, operator proxies, and sources that still need a proxy.

Skin-tone sampling is gated so walls, sky, and pavement no longer skew the skin balance, and the confidence score rewards a solid analysis (original decode, applied transform, trusted metrics, a healthy frame count) rather than only penalising a missing chart.

The color pipeline panel lets the operator choose the source profile used for the ACES analysis intent. If the app cannot confirm an executed OCIO transform, the metrics remain provisional.

### RAW decode

Cinema RAW that has no built-in decoder no longer stops the analysis:

- **BRAW** decodes directly.
- **R3D, R3D NE, and Nikon N-RAW** decode through the free RED SDK / REDline when it is installed.
- **Canon Cinema RAW Light, Sony X-OCN, and ARRIRAW** decode through DaVinci Resolve when it is installed and open.
- **Apple ProRes RAW** decodes directly.

A **Decoder Setup** panel shows, per format, whether it is ready or needs setup, links to the official free downloads, and lets you point CineFlow at an existing install. When a slot needs a decoder, you press **Generate proxy** to run the decode as a visible job — the analysis never starts a long decode without asking. An operator-selected MP4/MOV proxy is always available as a fallback, and unresolved cameras are marked provisional rather than blocking the run.

Saved runs keep provenance with the analysis, so later normalization and exports trace back to the media that was actually measured.

## On-Set Coach

Carries the saved look setup into a numbered on-set routine: confirm each camera on scopes and mark it ready, work the lighting checklist, and flag any failure mode you see on the monitor. A status strip and a "cleared to roll" indicator show how far through you are at a glance.

## Frame Preview

Loads media and previews multiple aspect-ratio frames so vertical, square, broadcast, and cinema delivery crops can be reviewed before post-production. Drag videos or images anywhere onto the window to add them, reframe each ratio on a large working canvas, and browse the loaded media from the strip along the bottom.
