This is designed to:

- Explain the app clearly
- Describe each module
- Show workflow sequence
- Be shareable with collaborators or clients
- Be expandable as features grow

# CINEFLOW SUITE

### Professional Production to Post Hub

Version: 1.0.0-beta.4

Platform: macOS (Apple Silicon)

Offline-first

---

# 1. What Is CineFlow Suite?

CineFlow Suite is a modular on-set media control system designed to bridge the gap between production and post-production:

- Plan shot sequences and equipment logic (Pre-Production)
- Match cameras and lock exposure on set (Production)
- Verify data and prep editorial blocks (Post-Production)
- Deliver professional client-ready documentation

It replaces fragmented tools with one unified, offline-secure workflow.

---

# 2. Core Philosophy

CineFlow is built around three pillars:

1. **Precision Planning** – Reduce on-set friction with references and structure.
2. **Visual Consistency** – Matched cameras and locked exposure.
3. **Post-Production Acceleration** – Zero-prep editorial handoff.

Each module supports one or more of these pillars.

---

# 3. Modules Overview

## 3.1 Pre-Production (The Plan)

### Shot Planner (Formerly Lookbook)
- **Purpose**: Analyze reference footage and build an actionable shooting plan.
- **Workflow**: Tag shot size, movement, and favorites. Sequence by storytelling logic (Canonical or Hook-First).
- **Output**: Branded reference sheets and mobile-friendly offline packs.

### Grid Mosaic
- **Purpose**: Rapid visual reporting.
- **Workflow**: Generate large multi-frame image grids (Contact Sheets) from clip thumbnails.
- **Output**: High-res JPEG mosaics or multi-page A4 PDFs.

### Folder Creator
- **Purpose**: Standardize project organization.
- **Workflow**: Generate sophisticated multi-platform folder structures for assets and proxies.

### Shot List & Starter Setup
- **Purpose**: Technical and creative documentation.
- **Workflow**: Build day sheets with equipment list and recommended camera "safe start" settings.

## 3.2 Production (The Shoot)

### Look Setup & Frame Preview
- **Purpose**: Visual baseline.
- **Workflow**: Plan looks, design LUTs, and review high-res frames immediately after capture.

### On-Set Coach & Match-Normalize
- **Purpose**: Technical consistency.
- **Workflow**: Interactive exposure monitoring and color-matching multiple camera bodies (e.g., matching B-Cam to A-Cam sensor).

### Camera Match Lab
- **Purpose**: Deep sensor analysis.
- **Workflow**: Advanced tool for matching disparate sensors through technical normalization.

## 3.3 Post-Production (The Handoff)

### Safe Copy
- **Purpose**: Data integrity guarantee.
- **Workflow**: Multi-destination copy with full hash verification (MD5/XXHash).
- **Output**: Branded PDF verification reports.

### Media Review (Ratings & Audio)
- **Purpose**: Rapid selection.
- **Workflow**: 0–5 star ratings, pick/reject flags, and waveform sparklines to detect audio clipping or silence.

### Scene Blocks
- **Purpose**: Editorial organization.
- **Workflow**: Group clips by timestamp proximity and camera labels into deterministic "blocks".

### Delivery
- **Purpose**: Intelligent handoff.
- **Workflow**: Export Resolve-ready FCPXML organized by Scene Blocks and Director Packs with full documentation.

---

# 4. Utilities (Micro-Apps)

Quick-access tools for calculations under pressure:

- **Crop Factor**: Sensor size and focal length math for matching look across cameras.
- **Video File Size**: Storage estimation for pro codecs (ARRIRAW, REDCODE, BRAW, ProRes).
- **Aspect Ratio**: Resolution math and delivery safe-frame calculation.
- **Transfer Time**: Real-world copy duration estimation based on hardware bottlenecks.

# 5. Recommended Workflow Sequence

This is the ideal operational order for a project lifecycle.

---

## PHASE 1 — Pre-Production (The Plan)

1. **Shot Planner**: Import references and build your shooting plan.
2. **Folder Creator**: Setup the drive structure before any media is recorded.
3. **Shot List**: Finalize the day sheet and equipment list.

Goal: Clear visual and structural roadmap.

---

## PHASE 2 — Production (The Shoot)

1. **Look Setup**: Baseline your exposure and LUTs.
2. **Match & Normalize**: Ensure multiple camera bodies are seeing the same colors and exposure levels.
3. **On-Set Coach**: Monitor exposure consistency throughout the day.

Goal: Consistent capture and zero technical debt.

---

## PHASE 3 — Post-Production (The Handoff)

1. **Safe Copy**: Backup media and verify data integrity immediately.
2. **Media Review**: Rapidly rate clips and verify audio technicals.
3. **Scene Blocks**: Organize your selects into meaningful editorial groups.
4. **Delivery**: Export to Resolve and hand off the Director Pack.

Goal: Faster editorial turnaround and professional client delivery.

---

# 6. Who Is This For?

- Director of Photography
- DIT
- Creative Director
- Editor
- Post Supervisor
- Art documentation teams
- Multi-camera production environments

---

# 7. What Makes CineFlow Different?

- **Phased Ecosystem**: Plan (Pre), Protect (Prod), and Prep (Post) in one app.
- **Offline and Secure**: Local-first architecture designed for set and studio environments.
- **Designed for Pressure**: Rapid-entry tagging and deterministic exports.
- **Micro-App Integration**: Floating utilities for on-the-spot technical math.

---

# 8. Ongoing Development

CineFlow is a living ecosystem. Future modules under consideration:

- Multi-user project sync / Cloud backup
- Automated proxy generation
- AI-assisted clip summarization
- Advanced DIT color pipeline management

This document must be updated whenever new modules or micro-apps are added.

---

# 9. Document Maintenance Policy

Whenever new features are implemented:

1. Add module description under “Modules Overview”.
2. Update workflow phase sequence if necessary.
3. Update version number at top.
4. Maintain clarity and non-technical tone.

This document is the authoritative operational guide for CineFlow Suite.

---

# Shot Planner — The Cinematography & Sequencing Guide

This module transforms reference footage into a structured **shooting plan**.

It is designed for:

- Pre-production planning
- On-set visual reference
- Structured storytelling flow
- Fast decision-making under pressure

---

# 1. Tagging System (Controlled + Fast)

Each reference clip supports controlled taxonomy fields.

## Shot Size (Canonical Order)

- EWS / ELS
- WS / LS
- FS
- MS
- MCU
- CU
- ECU
- Detail / Insert

These define the narrative scale of the shot.

## Movement

- Static / Locked
- Handheld
- Gimbal follow
- Push-in
- Pull-out
- Pan
- Tilt
- Slide / Truck
- Arc / Orbit
- Crane / Jib
- Zoom in
- Zoom out

Tags are:

- Controlled (dropdown)
- Type-to-search
- Extendable (new tags can be added)
- Stored persistently
- Never overwritten by auto-analysis

---

# 2. Sequencing Modes

Each Shot Planner project supports three sequencing strategies.

## Canonical (Default)

Classic cinematic escalation:

**Context → Action → Emotion → Detail**

Order:

1. EWS
2. WS
3. FS
4. MS
5. MCU
6. CU
7. ECU
8. Detail

Movement acts as a secondary ordering key.

Best for:

- Narrative storytelling
- Commercial structure
- Documentary flow

---

## Hook-First (Vertical / Social Optimized)

Designed for 9:16 and short-form platforms.

Order:

1. Detail
2. ECU
3. CU
4. MCU
5. MS
6. WS
7. EWS

Starts with high-impact visuals before context.

Best for:

- Instagram Reels
- TikTok
- Short-form storytelling

---

## Custom Manual

User-defined order using the `manual_order` field.

Best for:

- Highly specific shot lists
- Director-driven sequencing

---

# 3. Vertical 9:16 Mode

Shot Planner projects can be exported in vertical mode.

When enabled:

- 9:16 thumbnails are generated
- Deterministic center crop is applied
- Safe-frame overlays are available:
    - None
    - Center-safe (caption-safe)
    - Top-safe (UI-safe)

This allows accurate composition preview for vertical delivery.

---

# 4. Auto Analyze (Motion + Light)

Auto Analyze runs as a background job.

It generates deterministic (non-ML) visual tags:

- Motion: static / moving / high-motion
- Brightness: low / normal / bright
- Contrast: flat / normal / punchy
- Temperature: warm / cool / neutral

Auto tags:

- Never overwrite manual tags
- Are stored separately
- Can be filtered in-app
- Can be included in Shot Planner export

Example filtering:

- CU + Push-in + Warm
- High-motion + Bright
- Static + Low-key

---

# 5. Shot Planner Pack (Mobile Export)

Exports an offline mobile-friendly package:

ShotPlannerPack__/
index.html
data.json
assets/
thumbs/
thumbs_9x16/        (if vertical mode enabled)
overlays/
lookbook.pdf          (optional)

The pack works fully offline once unzipped.

---

# 6. Mobile Viewer Experience

The Shot Planner Pack includes:

### Tabs

- Sequence
- Tags
- Favorites

### Full-Screen Viewer

- Tap any reference
- Swipe left/right to navigate
- Toggle safe-frame overlays
- View Shot Size + Movement tags
- See Auto tags and notes

Designed for:

- One-hand operation
- Fast browsing on set
- Clear shot planning reference

---

# 7. How to Open on iPhone

1. Export Shot Planner Pack as ZIP.
2. Share via:
    - AirDrop
    - iCloud Drive
    - Google Drive
3. On iPhone:
    - Open Files app
    - Tap the ZIP to unzip
    - Open `index.html`

No internet connection required after unzip.

---

# 8. Practical Shooting Example (Restaurant / Chef)

## Canonical Order (Structured Coverage)

1. EWS — Establish restaurant atmosphere
2. WS — Chef in kitchen environment
3. MS — Cooking process
4. MCU — Chef expression
5. CU — Food preparation
6. ECU / Detail — Plating, textures, hands

## Hook-First (Vertical Social Content)

1. Detail / ECU — Plating moment
2. CU — Chef reaction
3. MS — Cooking action
4. WS — Context shown later

This transforms references into an actionable shot plan.

---

# Summary

The Shot Planner is no longer just a reference storage tool.

It is:

- A structured cinematography planner
- A vertical-aware shot sequencing system
- An on-set mobile reference tool
- A deterministic export engine

It bridges inspiration and execution.