# CineFlow Suite — Complete User Guide

> **Version:** 1.0.4 · **Platforms:** macOS, Windows · **Architecture:** Offline-first, local-only

---

## What Is CineFlow Suite?

CineFlow Suite is a professional desktop application built for film and video production crews. It solves the fragmentation problem: today's productions run five or more disconnected tools — a folder on a hard drive, a Numbers sheet, someone's phone camera, an external LUT app, a manual copy job. CineFlow replaces all of them with one offline, structured, studio-grade workspace.

**Who it is for:**
- Director of Photography (DP)
- Digital Imaging Technician (DIT)
- Camera Operator
- 1st & 2nd AC
- Producer / Creative Director
- Editor and Post Supervisor
- Art Documentation and BTS teams
- Any multi-camera or high-volume production environment

**The three pillars:**
1. **Plan (Pre-Production)** — reduce on-set friction with references and structure before the camera rolls.
2. **Protect (Production)** — lock exposure, match cameras, and keep the set technically disciplined.
3. **Prep (Post-Production)** — verify data integrity and deliver a clean, organized editorial handoff.

---

## Navigation Overview

The app is organized into three phases accessible from the top navigation bar:

| Tab | Purpose |
|---|---|
| **Pre-Production** | Folder structure, references, shot planning, and documentation |
| **Production** | Project management, look locking, camera matching, on-set discipline |
| **Post-Production** | Media review, safe backup, scene organization, and editorial export |

The **Utilities** button (top-right of any screen) opens floating micro-app calculators that work from any phase without losing your current context.

The **Command Palette** (⌘K / Ctrl+K) gives keyboard-first access to any module or action in the app.

---

## Phase 1 — Pre-Production

> **Goal:** arrive on set with a clear visual and structural roadmap — no improvisation needed.

---

### Folder Creator

**Pain it kills:** Starting every project by manually creating the same nested folder tree, getting it slightly wrong, then spending hours reorganizing media after the shoot.

**What it does:** Generates a complete, multi-platform production folder structure in seconds. Choose a template (or customize one), point it at a drive, and the full hierarchy — camera rolls, audio, proxies, exports, project files — is created instantly with the correct naming conventions.

**When to use it:** First thing before any media is recorded. Run it at the production office, at the rental house, or in the van on the way to location.

**How it improves your work:** Every department knows exactly where to drop their media. Editorial receives a clean structure on day one. Ingests faster. No wasted time hunting for misplaced files.

---

### Duplicate Finder

**Pain it kills:** Running out of drive space because the same footage exists in three locations and nobody knows which is the original — or confidently deleting something that turns out to be unique.

**What it does:** Scans one or more folders for files that are byte-for-byte identical. Presents matches in a clear report showing filename, size, path, and exact duplicates side by side. Lets you review before any deletion happens.

**When to use it:** After ingests — especially when multiple team members have been offloading to the same destination. Also useful during archiving to identify redundant backups.

**How it improves your work:** Reclaims drive space safely. Removes the anxiety of manual cleanup. Gives you a documented record of what was deduplicated.

---

### Shot List

**Pain it kills:** Arriving on set with a shot list that lives in a Notes app, a PDF you can't edit, or someone's head — and having no clean printed reference when the director changes the plan.

**What it does:** A fast, clean shot list builder with minimal data entry. Add shot rows (scene, shot number, description, coverage type), build an equipment checklist for the day, and export a polished day-sheet PDF with your project name and branding.

**When to use it:** During pre-production meetings, tech scouts, and the morning of each shoot day.

**How it improves your work:** The whole crew works from the same document. The equipment list means nothing gets forgotten at the rental house. The PDF export is shareable via AirDrop, email, or printed on set.

---

### Shot Planner

**Pain it kills:** Showing up to set with a mood board full of Instagram screenshots that don't communicate shot size, movement, or sequence logic — and losing time explaining what you mean to the director and camera team.

**What it does:** A cinematography reference planning tool. Load video clips or images, tag each one with shot size (ECU, CU, MCU, MS, FS, WS, EWS, Detail/Insert) and camera movement (Static, Handheld, Gimbal Follow, Push-in, Pull-out, Pan, Tilt, Slide, Arc, Crane, Zoom), mark favorites, and sequence them using one of three modes:

- **Canonical** — classic cinematic escalation: Context → Action → Emotion → Detail. Best for narrative and commercial work.
- **Hook-First** — starts with the most impactful visual first (Detail → ECU → CU → wide). Optimized for vertical social content.
- **Manual** — fully custom order for director-driven shot lists.

**Auto-Analyze** runs in the background and detects motion (static / moving / high-motion), brightness, contrast, and color temperature of each clip — without ever overwriting your manual tags.

**Vertical 9:16 Mode:** Generate center-cropped vertical thumbnails with safe-frame overlays (caption-safe, UI-safe, or none) for accurate composition preview for Instagram Reels, TikTok, and similar formats.

**Shot Planner Pack export:** Creates a fully offline ZIP package (HTML viewer + thumbnails + PDF) that opens on an iPhone without internet. Hand it to the director on set for one-hand browsing — swipe through references, see shot tags, toggle safe frames.

**When to use it:** During pre-production. Load inspiration clips, tag them, sequence them, and export the pack the night before the shoot.

**How it improves your work:** The whole crew speaks the same language. No time wasted explaining a reference. The sequence tells a story. The mobile pack means the director holds the shooting plan in their pocket.

---

### Grid Mosaic

**Pain it kills:** Manually assembling contact sheets from footage frames — opening Photoshop, dragging dozens of screenshots into a grid, spending an hour on something that should take 30 seconds.

**What it does:** Loads a folder of video clips or images, extracts frame thumbnails automatically, and generates multi-frame image grids as high-resolution JPEGs or multi-page A4 PDFs. Control the grid density, number of frames per clip, and layout.

**When to use it:** For visual reports, coverage documentation, client deliverables, or fast selects review. Also useful for BTS documentation and showreels.

**How it improves your work:** A full day's coverage compressed into a shareable visual document in under a minute. Clients and directors can quickly scan what was shot.

---

### Starter Setup

**Pain it kills:** Arriving on set and spending the first 30 minutes arguing about what ISO, shutter angle, and format to shoot in — or discovering the camera package is set up inconsistently across A and B cam.

**What it does:** Generates a camera-specific technical setup sheet with recommended "safe start" values — format, frame rate, shutter angle, ISO range, white balance, log profile, and any camera-specific notes — for common cinema and hybrid cameras. Export it as a PDF to share with the AC team before call time.

**When to use it:** The day before the shoot. Send it to the rental house as a setup brief.

**How it improves your work:** Every camera in the package starts from a consistent, technically sound baseline. Less time configuring gear, more time making pictures.

---

## Phase 2 — Production

> **Goal:** consistent capture across the entire camera package, zero technical surprises, and a locked visual baseline every day.

The Production phase is **project-based**. Create a named project (project name + client name) and all your look decisions, match runs, and coach settings are saved and persistent across sessions.

---

### Project Manager

**Pain it kills:** Losing your look setup every time you open the app — or being unable to load last week's match settings when the client asks for the same look on the follow-up shoot.

**What it does:** Creates and manages named production projects with creation date, client name, and last-opened timestamp. Each project stores all look settings, camera match runs, and coach configurations independently. Open any past project to instantly restore its full state.

**When to use it:** Create a project at the start of every new production. Re-open it on pickup days, additional shooting days, and reshoots.

**How it improves your work:** Look decisions are never lost. Reshoots match the original without guesswork. Multi-day productions stay consistent automatically.

---

### Look Setup

**Pain it kills:** Spending 20 minutes every morning trying to re-derive the same LUT workflow and camera settings from memory — with slightly different results each time.

**What it does:** A visual look-definition tool tied to the active production project. Define your camera A/B/C roles, set the target look parameters (color temperature, exposure offset, contrast, LUT selection), and generate a deterministic capture guidance document. The settings are saved to the project and available to On-Set Coach and Match & Normalize.

**When to use it:** At camera prep and at the start of each shooting day.

**How it improves your work:** The look is defined once and locked. Every camera operator knows exactly what the reference look is. On-set coach can enforce it throughout the day.

---

### Camera Match Lab

**Pain it kills:** Two cameras at different stops and different sensor sizes shooting side by side, with the colorist discovering a massive mismatch in post — requiring hours of manual normalization that could have been caught and corrected in 10 minutes on set.

**What it does:** A deep sensor analysis tool. Import test clips from multiple cameras, inspect individual reference frames, and compare signal metrics side-by-side — exposure levels, color channel balance, and waveform readings. The lab generates per-camera normalization recommendations to bring all cameras into alignment before rolling on the talent.

**Supported formats:** BRAW (Blackmagic RAW), MP4, MOV. Results are cached per run so you can return to a match session without re-processing.

**When to use it:** Camera prep day, tech scouts, and any multi-camera day where cameras from different manufacturers or generations are mixed.

**How it improves your work:** Colorists receive footage that is already in the same ballpark. One-camera retouching in DaVinci Resolve becomes the exception, not the rule. Deliverable timelines compress significantly.

---

### On-Set Coach

**Pain it kills:** Drift. The look is right at 8am and progressively wrong by 3pm — changing light, changing eyes, changing monitors — until someone notices in post that the afternoon footage has a completely different feel.

**What it does:** Carries your saved Look Setup plan forward into fast on-set ready checks. Define warning toggles for exposure thresholds, white balance tolerance, and other technical parameters. The coach surfaces clear go/warning/stop signals the DIT or AC can read at a glance throughout the shooting day.

**When to use it:** As a persistent reference during each shooting day, starting from the first setup.

**How it improves your work:** Catches technical drift before it becomes a problem. Keeps the whole camera team aligned to the same visual standard. Reduces post-correction work caused by inconsistent capture.

---

### Match & Normalize

**Pain it kills:** Having a clear hero camera A but no repeatable process to align cameras B and C to it — leading to ad-hoc adjustments that work today and fail the next time you add a camera.

**What it does:** Designates a hero camera (camera A) and creates repeatable alignment presets for the rest of the camera package. Saves the normalization decisions to the project so the same match can be re-applied on pickup days, additional units, or reshoots without starting from zero.

**When to use it:** After Camera Match Lab analysis, once a normalization target has been established.

**How it improves your work:** The match is a one-time decision that becomes a saved preset. Any operator can apply it. Second units and pickups are consistent with principal photography without the DP having to be present.

---

### Frame Preview

**Pain it kills:** Not knowing how a shot will crop when it goes to a vertical delivery format, a square crop, or a wider delivery spec — and discovering in post that a key element is cut off.

**What it does:** Load any media file and preview it inside multiple aspect ratio frames simultaneously. Reframe content per format and export preview crops as reference images for the editorial team, the director, or the client.

**When to use it:** When a production has multiple delivery formats (cinema, broadcast, social vertical) and reframing decisions need to be made during production, not in post.

**How it improves your work:** Compositing choices are made with all delivery specs in mind. No post-production surprises. Client can approve reframing before the edit begins.

---

## Phase 3 — Post-Production

> **Goal:** a verified, organized, structured editorial handoff in the shortest possible time.

---

### Safe Copy

**Pain it kills:** The worst-case scenario: a corrupted or incomplete copy that isn't discovered until the editor opens a clip on the deadline — or a drive failure that was never verified against the source.

**What it does:** A professional data integrity tool for copying and verifying media. Configure source and destination path pairs, run the copy job with real-time progress monitoring, and verify every file using cryptographic hashing (Blake3). Generates branded, printable PDF verification reports for each job or the full queue — with file counts, byte totals, pass/fail status, and timestamps. Supports multi-destination queues: copy to multiple drives in a single operation.

**Verification modes:** Copy + Verify (write then confirm), Verify Only (audit an existing copy), Re-Verify (check a previously verified copy again).

**When to use it:** Immediately after every card offload and at the end of every shooting day. Never hand media to an editor without a completed Safe Copy report.

**How it improves your work:** You have documented proof that every file arrived intact. The PDF report is a paper trail the production can keep. If a drive fails months later, you know the backup was verified.

---

### Media Review

**Pain it kills:** Flipping through hundreds of clips in a generic file browser with no ratings, no audio check, and no way to mark selects — forcing the editor to make a first pass of something that should have already been curated on set.

**What it does:** A fast, DIT-grade clip review workspace. Load a footage folder, and every clip is listed with:
- **Thumbnail strip** — 3, 5, or 7 frame thumbnails across the clip duration, with configurable jump intervals
- **Star ratings** (0–5) for overall quality
- **Pick/Reject flags** for fast selects
- **Notes** field per clip for timecoded comments, camera notes, or director feedback
- **Audio waveform sparklines** — visual representation of the audio level across the clip for instant detection of clipping, silence, or dropout
- **LUT preview** — load a .cube LUT file and preview clips with it applied before any color work happens

Clips can be selected, sorted, and filtered. All metadata is saved to the local database and persists between sessions.

**Export:** Generate a PDF or image contact sheet of the reviewed clips with ratings, flags, notes, and thumbnails visible — a branded document ready for handoff.

**When to use it:** At wrap each day, before handing media to the editor. Also useful for multi-day selects review and as a visual log alongside the Safe Copy report.

**How it improves your work:** The editor receives a pre-curated workspace. Picks are marked, rejects are flagged, and notes are attached. Editorial turnaround is faster because the triage is already done.

---

### Scene Blocks

**Pain it kills:** An editor receiving a flat dump of 200+ clips with no organization — having to manually build a rough assembly just to understand the structure of the day.

**What it does:** Analyzes the metadata of all clips loaded in Media Review and automatically groups them into deterministic **scene blocks** — meaningful editorial chunks organized by timestamp proximity and camera labels. Each block represents a coherent segment of the shooting day (a setup, a location, a scene). Blocks are labeled, persistent, and survive re-opening the project.

From Scene Blocks you can jump directly into Delivery to export the organized structure to DaVinci Resolve.

**When to use it:** After Media Review is complete. Scene Blocks is the bridge between raw reviewed footage and the organized export.

**How it improves your work:** Editors receive footage that already has a logical structure. They can begin rough assembly immediately instead of spending hours just understanding what was shot and in what order.

---

### Delivery

**Pain it kills:** Spending an afternoon hand-building a DaVinci Resolve timeline bin structure from a flat folder — or delivering a "Director Pack" that is just a disorganized ZIP of everything.

**What it does:** Exports the reviewed and organized workspace in two formats:

**Resolve Export (FCPXML):** Generates a DaVinci Resolve-ready FCPXML file organized by Scene Blocks. The editor imports it and gets a structured bin with clips already in the right groupings. No manual organization required.

**Director Pack:** A branded, self-contained delivery folder — selects only (rejects excluded), organized by Scene Block, with ratings and notes included. The director or client receives a clean, structured package of the day's selects, not a raw data dump.

**Scope control:** Export all reviewed clips, or limit the export to only selected blocks from Scene Blocks view.

**When to use it:** At the end of each shooting day or at the end of principal photography as the final editorial handoff.

**How it improves your work:** Editorial gets a structured import instead of a flat folder. The director's review of selects is faster and more professional. Production documentation is delivered alongside the media.

---

## Utilities — Floating Micro-App Calculators

Utilities are accessible from any screen via the **Utilities** button (top-right header). They open as floating overlays — you never lose your place in the main workflow. Close them when done and you are right back where you were.

---

### Crop Factor Calculator

**Pain it kills:** Trying to figure out in your head what a 50mm lens actually looks like on an APS-C sensor with a 0.71x speed booster attached — getting it wrong, renting the wrong glass, and discovering on set that the shot doesn't work.

**What it does:** Calculates the full-frame equivalent focal length and equivalent aperture for any combination of sensor size and lens, with optional adapters (teleconverter, wide angle, fisheye). Includes one-tap presets for all major cinema and photo camera sensors from ARRI, RED, Sony, Canon, Nikon, Blackmagic, Panasonic, Fujifilm, and more. Supports both video sensor specs and photo/hybrid sensor specs.

**When to use it:** Lens selection, rental list prep, matching across a mixed camera package, and any time you need to know what a lens actually does on a specific body.

---

### Video File Size Calculator

**Pain it kills:** Ordering 2TB of media storage for a shoot, discovering on day one that BRAW 12:1 at 4K 60fps generates 3TB per day — and spending the night chasing drives.

**What it does:** Calculates the exact expected file size for a given camera, codec, resolution, frame rate, and recording duration. Includes accurate data rates for ARRIRAW, REDCODE, BRAW (all ratios), ProRes (all flavors), H.264, H.265, and more — pulled from official manufacturer specs. Input hours, minutes, and seconds to get the resulting file size in GB or TB.

**When to use it:** Pre-production storage budgeting, rental list prep, and any time a producer asks "how much storage do we need?"

---

### Aspect Ratio Calculator

**Pain it kills:** Having a 4096×3072 sensor crop and not knowing if it fits cleanly into a 2.39:1 delivery spec — or having to manually calculate what safe-frame dimensions look like for a vertical cut.

**What it does:** Enter any resolution (width × height) and instantly see the simplified ratio, the decimal ratio, and equivalents at standard reference dimensions (1920 height, 1080 width). Select a delivery target preset (16:9, 4:3, 2.39:1, 9:16, 1:1, and others) to see exactly how much the image is cropped on the sides or top/bottom, and what the reframed dimensions are. Shows the nearest standard ratio match.

**When to use it:** Camera selection, sensor crop planning, multi-format delivery confirmation, and reframing validation before production locks picture.

---

### Transfer Time Calculator

**Pain it kills:** Telling the producer "the offload will take 20 minutes" based on the theoretical max speed of the reader — then the actual offload takes 90 minutes because nobody accounted for the USB 3 hub, the spinning drive destination, and efficiency loss.

**What it does:** Calculates realistic transfer time based on three variables simultaneously: **source speed** (card reader / NVMe / SSD / SxS / CFexpress), **interface speed** (USB 3.2, Thunderbolt 3/4, USB-C, eSATA), and **destination speed** (spinning HDD, SSD, NVMe, RAID). The tool identifies the bottleneck stage (source, interface, or destination) and applies a real-world efficiency factor (0–100%) to give an honest estimate — not a theoretical maximum.

**When to use it:** Planning offload windows on a shooting day, justifying storage equipment budgets, and avoiding false promises to the production about how long card management will take.

---

## Global Features

### Command Palette (⌘K / Ctrl+K)

Open from any screen. Type to search all modules, apps, and actions. Navigate the entire app without touching the mouse.

### Jobs Panel

Background tasks (thumbnail extraction, file analysis, copy jobs) run without blocking the UI. The Jobs panel shows active and completed jobs, progress, and any errors. Accessible from the header on any screen.

### Settings

Configure app-level preferences including thumbnail behavior and display options.

### About CineFlow

Shows the current app version, build info, and a link to reset the interactive tour.

### Tour Guide

The in-app guided tour walks through every major module for first-time users. Launch it from the Help menu (? icon) at any time.

---

## Recommended Workflow Sequence

This is the ideal operational order across a full project lifecycle.

### Before the Shoot

1. **Folder Creator** → Build the drive structure before any media exists
2. **Starter Setup** → Generate the camera technical brief for the rental house
3. **Shot Planner** → Tag and sequence visual references, export the mobile pack
4. **Shot List** → Finalize the day sheet with equipment list

### On Set (Morning)

5. **Project Manager** → Open or create the production project
6. **Look Setup** → Define and lock the visual look for the day
7. **Camera Match Lab** → Analyze test clips, confirm all cameras are aligned
8. **Match & Normalize** → Save the alignment presets

### On Set (During the Day)

9. **On-Set Coach** → Monitor exposure and technical discipline throughout the shoot
10. **Frame Preview** → Confirm reframing for multi-format deliveries if needed

### At Wrap

11. **Safe Copy** → Offload all cards and verify integrity before any drive leaves the set
12. **Duplicate Finder** → Check the offload destination for accidental duplicates

### Post-Production

13. **Media Review** → Rate clips, mark picks/rejects, attach notes, verify audio
14. **Scene Blocks** → Organize reviewed footage into editorial groups automatically
15. **Delivery** → Export FCPXML for DaVinci Resolve or Director Pack for the client

---

## Offline-First Design

CineFlow Suite is intentionally local-only. Every operation — file analysis, thumbnail extraction, database storage, PDF export, hash verification — runs on the local machine with no internet required. This is not a technical limitation; it is a deliberate security decision for set and studio environments where sensitive media must never touch a third-party server.

The only network operation in the direct-distribution build is license activation (one-time, against a self-hosted server). Everything else works offline indefinitely.

---

## Trial Mode (Direct Distribution Only)

First-time users can activate a 14-day free trial with no account required. The trial binary is the full app — no re-download after purchase.

**Trial unlocks:** Folder Creator, Duplicate Finder, Shot List, Project Manager, Look Setup, Camera Match Lab, Safe Copy, Media Review, Scene Blocks.

**Full license unlocks additionally:** Shot Planner, Grid Mosaic, Starter Setup, On-Set Coach, Match & Normalize, Frame Preview, Delivery.

After purchasing a license, enter the email and key in the activation screen (or via the Upgrade button in the trial banner). The app unlocks all modules instantly with no reinstall.

---

*CineFlow Suite is actively developed. This guide reflects version 1.0.4. Features and modules are updated regularly.*
*For support: hello@expose-u.com*
