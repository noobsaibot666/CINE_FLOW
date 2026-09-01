---
title: Data and Exports
description: Local data persistence, export branding, and report behavior.
---

# Data and Exports

## Local Data

CineFlow stores project metadata and persistent application state locally. Production match runs, settings, and review metadata should remain available across sessions without depending on a cloud service.

## Match Lab Persistence

Camera Match Lab analysis runs are stored so users can reopen, compare, and export earlier tests. Typical stored data includes run metadata, source clips, measured metrics, deltas, and recommendations.

## Export System

Exports include:

- Contact sheet PDFs and images (clean black-and-white layout)
- Grid mosaic contact walls (PDF and image)
- Safe Copy reports
- Match sheets
- Shot list and starter setup sheets
- FCPXML timelines for editorial handoff
- Director Pack folders
- CSV or structured handoff formats where applicable

Export branding stays visually consistent across the PDF, image, and report paths.

### FCPXML timelines

The timeline export targets Final Cut Pro and DaVinci Resolve. Media links are written as fully percent-encoded `file://` URIs inside a media representation element, frame rates use standard broadcast timebases, and marker durations are conformed to the clip timebase. Output is deterministic for the same input. Premiere Pro does not read FCPXML.

