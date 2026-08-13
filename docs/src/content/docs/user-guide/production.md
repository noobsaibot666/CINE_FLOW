---
title: Production
description: CineFlow Suite production tools and workflows.
---

# Production

The Production phase is project-based. Create a named project with project and client metadata, then keep look decisions, camera match runs, and coach settings persistent across sessions.

## Project Manager

Creates and reopens production projects. Each project stores look settings, camera match runs, and coach configuration independently.

## Look Setup

Defines camera roles, target look parameters, color temperature, exposure offset, contrast, and LUT selection. The saved look setup feeds On-Set Coach and Match & Normalize.

## Camera Match Lab

Imports test clips from multiple cameras, inspects representative frames, compares luma and RGB metrics, and generates per-camera normalization recommendations.

Each selected camera shows its analysis path, source profile state, ACES path status, confidence, and warnings. Analysis paths distinguish original media, vendor-decoded sources, operator proxies, and sources that require a proxy.

Saved runs keep provenance with the analysis, including capability metadata, decode path, and confidence. This makes later normalization and exports traceable to the media that was actually measured.

## On-Set Coach

Carries the saved look setup into quick on-set checks. Warning toggles can track exposure thresholds, white balance tolerance, and other technical parameters.

## Match & Normalize

Designates a hero camera and saves repeatable alignment presets for the rest of the camera package. Use it after Camera Match Lab has established the normalization target.

When a saved Camera Match Lab run is selected, Match & Normalize builds steps from measured exposure, WB/tint drift, chart quality, decode path, and confidence. Exported PDFs include the same evidence so a preset can be traced back to the saved analysis run.

## Frame Preview

Loads media and previews multiple aspect ratio frames so vertical, square, broadcast, and cinema delivery crops can be reviewed before post-production.
