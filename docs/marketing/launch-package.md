# CineFlow Suite 1.0.8 — Launch & Promotion Package

Update push for a build already live on the Mac App Store and the storefront. Copy is paste-ready. Asset rows give exact filename, pixel size, format. `☐` = to do. §7 is the rollup.

| | |
|---|---|
| Product name | `CineFlow Suite` |
| App Store listing name (30) | `CineFlow Suite` — 14/30, already live, no change |
| Bundle ID / category | `com.exposeu.cineflow` · Video (`public.app-category.video`) |
| Version | `1.0.8` — update to an existing listing, not a first release |
| App Store URL | `https://apps.apple.com/app/cineflow-suite/id6762373842` |
| Price | `€59` direct (storefront) · matching Mac App Store tier |
| Storefront | `alan-design.com/#/store` — `web_three/src/data/storeProducts.json`, slug `cineflow` |
| Docs / support | `https://docs.alan-design.com/cineflow/` (base path `/cineflow`) |
| Copyright | `© 2026 Alan Alves` |

**Brand rules for every asset:** dark UI only — app background `#08080a`, cards `#141417`, text `#f4f4f5`, one accent `#a592ff` (muted lavender) used sparingly. Inter typeface. Premium, minimalist, high-fashion restraint — no added gradients, glows, or drop shadows in mockups. Capture the real UI, never stock footage of cameras or sets. In-app PDF/contact-sheet exports are black-and-white **by design** — do not "correct" them to colour in screenshots. Every capture uses a clean demo project: no real client names, no disk paths, no licence keys in frame.

---

## Canonical copy — reuse everywhere

```
One-liner:  CineFlow Suite is a local-first macOS workspace that carries a film shoot
            from pre-production planning through on-set camera discipline to a verified
            editorial handoff.
Short:      One workspace for the whole shoot
Pitch:      CineFlow Suite replaces the folders, spreadsheets, phone notes, and improvised
            handoff docs a shoot runs on with one offline desktop app. Plan the structure,
            match the cameras, verify every card, review the dailies, and hand editorial a
            clean package — without anything leaving your machine.
```

**Plan → Protect → Prep: one local-first app across all three stages of a shoot.**

**Proof points:** fully offline, no subscription; Camera Match Lab across an eight-brand camera database; cinema RAW decode for BRAW, R3D, N-RAW, Cinema RAW Light, X-OCN, ARRIRAW and ProRes RAW; BLAKE3-verified card offload; FCPXML and Director Pack handoff; deterministic exports.
**Audience:** DPs, DITs, camera operators, 1st/2nd ACs, producers, and post supervisors on mixed-camera productions.
**Hashtags:** `#filmmaking #cinematography #DIT #onset #cameradept #postproduction #colorgrading #indiefilm #filmproduction #madeonmac`

---

## 1. Mac App Store

### 1.1 Text fields

| ✓ | Field | Limit | Value |
|---|---|---|---|
| ☐ | Name | 30 | `CineFlow Suite` — 14/30, unchanged |
| ☐ | Subtitle | 30 | `On-set camera prep & handoff` — 28/30 |
| ☐ | Promotional text | 170 | `Camera Match Lab now decodes BRAW, R3D, N-RAW, Cinema RAW Light, X-OCN, ARRIRAW and ProRes RAW for analysis — with guided decoder setup so a match check never dead-ends.` — 167/170 |
| ☐ | Keywords | 100, no space after commas | `cinematography,DIT,dailies,shot list,contact sheet,color match,LUT,proxy,FCPXML,footage offload,RAW` — 99/100 |
| ☐ | Description | 4000 | block below — ~1560/4000 |
| ☐ | What's New | 4000 | block below — ~1780/4000 |
| ☐ | Support URL | — | `https://docs.alan-design.com/cineflow/` |
| ☐ | Marketing URL | — | `https://docs.alan-design.com/cineflow/` |
| ☐ | Privacy Policy URL | — | `https://docs.alan-design.com/cineflow/legal/privacy-policy/` |
| ☐ | Category / Age | — | Video · Photography · 4+ |
| ☐ | Copyright | — | `© 2026 Alan Alves` |

**Description** (~1560/4000):
```
CineFlow Suite is a local-first macOS workspace for film and video crews. It carries a
shoot from pre-production planning, through on-set camera discipline, to a verified
editorial handoff — offline, on one machine, no subscription.

PLAN
- Folder Creator lays down the project structure before media is recorded.
- Reference Board collects look references and exports grid-mosaic contact walls.
- Shot List and camera starter sheets brief the crew.
- Duplicate Finder clears redundant media with a verified move-to-Trash.

PROTECT
- Look Setup locks the grade intent and captures an on-set playbook.
- Camera Match Lab measures exposure, white balance, and colour between camera bodies
  across an eight-brand database, with an evidence-backed confidence score and a plain
  do-this adjustment list.
- Cinema RAW decode for analysis: BRAW and ProRes RAW directly; R3D, R3D NE, and Nikon
  N-RAW through an installed RED SDK / REDline; Canon Cinema RAW Light, Sony X-OCN, and
  ARRIRAW through DaVinci Resolve. A Decoder Setup panel links the free downloads and
  points the app at existing installs.
- On-Set Coach runs the pre-roll checklist. Frame Preview checks delivery framing.

PREP
- Safe Copy offloads cards with BLAKE3 verification and per-card reports.
- Media Review flags picks and rejects with frame-accurate thumbnails.
- Contact Sheets print in a clean black-and-white layout.
- Export FCPXML timelines for Final Cut Pro and DaVinci Resolve, or a full Director Pack.

Everything runs locally. Projects, match runs, and review notes stay on your disk.
```

**What's New** (~1780/4000):
```
NEW
- Camera Match Lab decodes cinema RAW for analysis: BRAW and ProRes RAW directly; R3D,
  R3D NE, and Nikon N-RAW via an installed RED SDK / REDline; Canon Cinema RAW Light,
  Sony X-OCN, and ARRIRAW via DaVinci Resolve. A Decoder Setup panel reports readiness
  and links the free downloads; an explicit Generate proxy step runs the decode as a
  visible job.
- Expanded camera database across ARRI, Sony, Canon, Panasonic, Nikon, RED, Blackmagic,
  and Fujifilm, including recent cinema and hybrid bodies.
- Reference Board (formerly Shot Planner) with grid-mosaic contact walls exported from
  the same view.
- Duplicate Finder scan options, a keep-newest / keep-oldest / keep-shortest bulk
  cleanup with verified move-to-Trash, and cancellable scans.
- Look Setup notes open in a modal saved with the project; the results section is now an
  on-set playbook with a readiness checklist.
- Frame Preview accepts drag-and-drop media anywhere on the window.
- Media Review: click any filmstrip frame to enlarge and page through frames.
- Safe Copy moved to Pre-Production; Starter Setup moved to Production.

IMPROVED
- On-Set Coach and Match & Normalize restructured into numbered, higher-contrast steps.
- Camera Match Lab analysis: chroma-gated skin sampling and an evidence-aware confidence
  score.
- Contact-sheet PDF and image exports render in a clean black-and-white layout.
- Sharper filmstrip thumbnails.
- Production page: Project Manager in a header menu, compact Jobs, an always-visible
  active-project pill, and a first-run project prompt.

FIXED
- FCPXML timeline export imports cleanly into Final Cut Pro and DaVinci Resolve: encoded
  file:// media links, standard broadcast timebases, clip-timebase marker durations.
- Delivery & Export dialog contrast; the two conditional buttons are now one primary
  action.
```

### 1.2 Screenshots

**Spec:** 2560×1600 · 16:10 · PNG, no alpha, sRGB · replace all 10 for the update · clean demo project.

| ✓ | # | Filename | Screen / state | Caption (≤6 words) |
|---|---|---|---|---|
| ☐ | 01 | `cineflow-appstore-01-match-lab.png` | Camera Match Lab, 3-camera grid with deltas + do-this checklist | Match cameras before mixed days |
| ☐ | 02 | `cineflow-appstore-02-raw-decode.png` | Decoder Setup panel + Generate proxy on an R3D clip | Decode BRAW, R3D, ARRIRAW |
| ☐ | 03 | `cineflow-appstore-03-reference-board.png` | Reference Board with grid-mosaic export dialog | Build the look from references |
| ☐ | 04 | `cineflow-appstore-04-safe-copy.png` | Safe Copy verification queue mid-run | BLAKE3-verified card offload |
| ☐ | 05 | `cineflow-appstore-05-media-review.png` | Media Review, filmstrip with one frame enlarged | Review dailies, flag picks |
| ☐ | 06 | `cineflow-appstore-06-contact-sheet.png` | Black-and-white contact sheet PDF preview | Clean black-and-white contact sheets |
| ☐ | 07 | `cineflow-appstore-07-on-set-coach.png` | On-Set Coach numbered pre-roll routine | Run the on-set checklist |
| ☐ | 08 | `cineflow-appstore-08-look-setup.png` | Look Setup playbook + notes modal | Lock the look, brief crew |
| ☐ | 09 | `cineflow-appstore-09-duplicate-finder.png` | Duplicate Finder results + bulk cleanup | Find and clear duplicate media |
| ☐ | 10 | `cineflow-appstore-10-export.png` | Export panel — FCPXML + Director Pack | Hand off to Final Cut or Resolve |

### 1.3 App Preview video

**Spec:** 1920×1080 · 30 fps · 15–30 s · `.mov` H.264/ProRes · screen-recording only, no cursor hunting · first frame = poster · owned/licensed audio only.

- ☐ `cineflow-appstore-preview-01.mov`

| Time | On screen |
|---|---|
| 0–3s | Camera Match Lab open, three camera bodies loaded |
| 3–9s | Run analysis → exposure / WB / colour deltas populate, confidence score |
| 9–15s | Open an R3D → Decoder Setup panel → Generate proxy → analysis completes |
| 15–22s | Cut to the do-this adjustment list, then contact-sheet export |
| 22–27s | End card: CineFlow Suite · plan, protect, prep · Mac App Store |

---

## 2. Storefront — `alan-design.com/#/store`

**How it renders (frame for both — no separate mobile files):**

| Surface | Desktop | Mobile (<960px) | Deliver |
|---|---|---|---|
| Card `image` | 16:10 cover, ~453×283 CSS (@2x ≈ 906×566) | 1-col, up to ~768×480 CSS | 1600×1000 WebP q82, <250 KB |
| Modal `gallery` still | ~720 CSS wide, stacked | full-width 100vw×50vh, scroll-snap, crops ~4:3 — keep content centred | 1920×1200 WebP q82, <400 KB ea |
| Gallery video | same slot as a still | same | 1600×1000 MP4 H.264, muted, loop, 12–20 s, <8 MB |

### 2.1 `storeProducts.json` entry

- ☐ Replace the `cineflow` object in `web_three/src/data/storeProducts.json` (keeps `id`, `price`, `stripePriceId`, `stripeMode`, `appStoreUrl`, `downloadUrl`; rewrites copy; canonical asset names; clears `badge`):

```json
{
  "id": "cineflow",
  "name": "CineFlow Suite",
  "category": "Apps",
  "description": "Local-first macOS workspace that runs a film shoot from pre-production planning to a verified editorial handoff.",
  "longDescription": "CineFlow Suite brings the scattered parts of a shoot — folder structure, look references, camera matching, card offload, dailies review, and editorial handoff — into one offline desktop app. Camera Match Lab measures exposure, white balance, and colour between camera bodies and decodes cinema RAW (BRAW, R3D, N-RAW, Cinema RAW Light, X-OCN, ARRIRAW, ProRes RAW) for analysis. Safe Copy verifies every card with BLAKE3, and exports go straight to Final Cut Pro, DaVinci Resolve, or a Director Pack. Nothing leaves your machine.",
  "features": [
    "Camera Match Lab: exposure, white balance, and colour matching across an eight-brand camera database",
    "Cinema RAW decode for analysis with guided decoder setup (BRAW, R3D, N-RAW, Cinema RAW Light, X-OCN, ARRIRAW, ProRes RAW)",
    "Safe Copy: BLAKE3-verified card offload with per-card reports",
    "Reference Board with grid-mosaic contact walls",
    "Duplicate Finder with verified bulk cleanup",
    "Black-and-white contact sheets, FCPXML timelines, and Director Pack export",
    "Fully offline — projects, match runs, and notes stay on your disk"
  ],
  "price": "€59",
  "stripePriceId": "price_1TNeEgCsCSs3k4X1vI6y28he",
  "appStoreUrl": "https://apps.apple.com/app/cineflow-suite/id6762373842",
  "downloadUrl": "https://alan-design.com/#/download",
  "image": "/assets/images/store/cineflow/cineflow-hero.webp",
  "gallery": [
    { "type": "video", "url": "/assets/videos/cineflow-loop.mp4" },
    { "type": "image", "url": "/assets/images/store/cineflow/cineflow-01-match-lab.webp" },
    { "type": "image", "url": "/assets/images/store/cineflow/cineflow-02-raw-decode.webp" },
    { "type": "image", "url": "/assets/images/store/cineflow/cineflow-03-reference-board.webp" },
    { "type": "image", "url": "/assets/images/store/cineflow/cineflow-04-safe-copy.webp" },
    { "type": "image", "url": "/assets/images/store/cineflow/cineflow-05-media-review.webp" },
    { "type": "image", "url": "/assets/images/store/cineflow/cineflow-06-contact-sheet.webp" }
  ],
  "stripeLink": "https://buy.stripe.com/test_cineflow",
  "stripeMode": "payment",
  "badge": ""
}
```

- The live entry currently points at `.png` files with legacy names (`cineflow-thumb.png`, `cineflow-overview.png`, …). Either re-export to the canonical `.webp` names above, or keep the legacy names and only swap in the new copy — decide in §8.
- **Caveat:** a Store Manager **Publish** rewrites this file — see §8.

### 2.2 Assets

Reuse the §1.2 captures without caption overlays.

| ✓ | Asset | Path | Size | Budget |
|---|---|---|---|---|
| ☐ | Card thumbnail | `web_three/public/assets/images/store/cineflow/cineflow-hero.webp` | 1600×1000 | <250 KB |
| ☐ | Gallery 01 — Match Lab | `.../store/cineflow/cineflow-01-match-lab.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery 02 — RAW decode | `.../store/cineflow/cineflow-02-raw-decode.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery 03 — Reference Board | `.../store/cineflow/cineflow-03-reference-board.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery 04 — Safe Copy | `.../store/cineflow/cineflow-04-safe-copy.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery 05 — Media Review | `.../store/cineflow/cineflow-05-media-review.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery 06 — Contact sheet | `.../store/cineflow/cineflow-06-contact-sheet.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery loop | `web_three/public/assets/videos/cineflow-loop.mp4` | 1600×1000, 12–20 s | <8 MB |

---

## 3. Astro docs site

Base path `/cineflow/`. Stills → `docs/public/screenshots/`, media → `docs/public/media/`. Hand-authored markdown image links **must** carry the base prefix: `![](/cineflow/screenshots/<file>)`.
**Spec:** capture 2560×1600 → WebP ≤1600 px wide, q≈82, <400 KB. Name `cineflow-docs-<page>-NN-<slug>.webp`.

| ✓ | File | Doc page | Shows |
|---|---|---|---|
| ☐ | `cineflow-docs-getting-started-01-phases.webp` | `user-guide/getting-started` | Top nav with the three phase tabs |
| ☐ | `cineflow-docs-pre-production-01-safe-copy.webp` | `user-guide/pre-production` | Safe Copy verification queue |
| ☐ | `cineflow-docs-pre-production-02-duplicate-finder.webp` | `user-guide/pre-production` | Duplicate Finder scan options + results |
| ☐ | `cineflow-docs-pre-production-03-reference-board.webp` | `user-guide/pre-production` | Reference Board with grid-mosaic export |
| ☐ | `cineflow-docs-production-01-project-manager.webp` | `user-guide/production` | Header Project Manager menu + active-project pill |
| ☐ | `cineflow-docs-production-02-look-setup.webp` | `user-guide/production` | Look Setup playbook + notes modal |
| ☐ | `cineflow-docs-production-03-match-lab.webp` | `user-guide/production` | Camera Match Lab three-column grid |
| ☐ | `cineflow-docs-production-04-decoder-setup.webp` | `user-guide/production` | Decoder Setup panel + Generate proxy |
| ☐ | `cineflow-docs-production-05-on-set-coach.webp` | `user-guide/production` | On-Set Coach numbered routine |
| ☐ | `cineflow-docs-production-06-match-normalize.webp` | `user-guide/production` | Match & Normalize three-step flow |
| ☐ | `cineflow-docs-production-07-frame-preview.webp` | `user-guide/production` | Frame Preview with drag-drop overlay |
| ☐ | `cineflow-docs-post-production-01-media-review.webp` | `user-guide/post-production` | Media Review, enlarged filmstrip frame |
| ☐ | `cineflow-docs-post-production-02-contact-sheet.webp` | `user-guide/post-production` | Black-and-white contact sheet |
| ☐ | `cineflow-docs-post-production-03-exports.webp` | `user-guide/post-production` | Export panel — FCPXML + Director Pack |

**Other art:**
- ☐ `cineflow-docs-og.png` — 1200×630 OpenGraph card
- ☐ favicon 512×512 PNG (confirm one is wired in `astro.config.mjs` / `src/`)
- ☐ optional `cineflow-docs-diagram-plan-protect-prep.svg` — the three-pillar workflow, for `product/vision`
- ☐ rebuild `docs/`, swap `dist/` into the NAS mount, restart `docs-nginx`

---

## 4. Social (organic)

### 4.1 Copy bank
```
Hooks (first line / first frame):
- Your camera match check just hit a RAW file it can't read. Now what?
- BRAW, R3D, ARRIRAW, X-OCN — matched in one window.
- The shoot lives in twelve folders and a group chat. Not anymore.
- Offload, verify, review, hand off — all offline.
CTA:
- On the Mac App Store.
- Docs: docs.alan-design.com/cineflow
Don't: name other tools; claim speed multipliers; use unlicensed music on the
App Store preview; leave a real client name, disk path, or licence key in frame.
```

### 4.2 Instagram
**Feed carousel** — 1080×1350, PNG, 7 slides, text ≥96 px from edges. `cineflow-ig-carousel-0N-<slug>.png`.

| ✓ | # | Headline | Sub |
|---|---|---|---|
| ☐ | 01 | RAW that doesn't dead-end | Camera Match Lab · CineFlow Suite 1.0.8 |
| ☐ | 02 | BRAW + ProRes RAW | Decoded in-app, no setup |
| ☐ | 03 | R3D · R3D NE · N-RAW | Via RED SDK / REDline |
| ☐ | 04 | Cinema RAW Light · X-OCN · ARRIRAW | Via DaVinci Resolve |
| ☐ | 05 | Decoder Setup | Links the free downloads, points at your installs |
| ☐ | 06 | Then: the actual match | Exposure, WB, colour deltas + a do-this list |
| ☐ | 07 | CineFlow Suite | On the Mac App Store |

- ☐ Publish carousel post:
```
Camera Match Lab in CineFlow Suite 1.0.8 now decodes cinema RAW for analysis —
BRAW and ProRes RAW directly, R3D / R3D NE / N-RAW through the RED SDK, and
Cinema RAW Light / X-OCN / ARRIRAW through DaVinci Resolve. A match check no
longer stops at a file it can't read.

On the Mac App Store.
#filmmaking #cinematography #DIT #onset #cameradept #postproduction #colorgrading #indiefilm #filmproduction #madeonmac
```

**Reel / Story** — 1080×1920, MP4 H.264+AAC, 15–30 s, safe centre 1080×1420.
- ☐ `cineflow-ig-reel-raw-decode.mp4` · ☐ `cineflow-ig-story-raw-decode.mp4`

| Time | Visual | Caption |
|---|---|---|
| 0–3s | R3D dropped into Match Lab → "decoder required" state | RAW that won't open? |
| 3–9s | Open Decoder Setup, point at REDline, Generate proxy | One panel, free downloads linked |
| 9–15s | Analysis completes → deltas + do-this list | Then the actual match |
| 15–20s | End card | CineFlow Suite · Mac App Store |

### 4.3 X / Twitter
- ☐ `cineflow-x-single-01.png` — 1600×900 (Match Lab grid, "RAW that doesn't dead-end")
- ☐ `cineflow-x-video-01.mp4` — 1920×1080, ≤2:20 (reuse the App Preview cut)
- ☐ Publish thread:
```
1/ CineFlow Suite 1.0.8: Camera Match Lab now decodes cinema RAW for analysis, so a
   match check doesn't stop at a file it can't read.
2/ BRAW and Apple ProRes RAW decode directly — nothing to install.
3/ R3D, R3D NE and Nikon N-RAW go through an installed RED SDK / REDline. Cinema RAW
   Light, Sony X-OCN and ARRIRAW go through DaVinci Resolve.
4/ A Decoder Setup panel reports what's ready, links the free downloads, and points the
   app at installs you already have. Then you press Generate proxy and it runs as a job.
5/ Also in 1.0.8: eight-brand camera database, Reference Board with grid mosaics,
   Duplicate Finder cleanup, black-and-white contact sheets, FCPXML that Final Cut and
   Resolve actually import. On the Mac App Store → apps.apple.com/app/cineflow-suite/id6762373842
```

### 4.4 YouTube & TikTok

| ✓ | Asset | Size | Length | File |
|---|---|---|---|---|
| ☐ | Walkthrough | 1920×1080 | 3–4 min | `cineflow-yt-walkthrough.mp4` |
| ☐ | Thumbnail | 1280×720 | — | `cineflow-yt-thumb-01.png` (overlay: "RAW, matched") |
| ☐ | Short / TikTok | 1080×1920 | 20–35 s | `cineflow-short-raw-decode.mp4` |

**Walkthrough outline:** new project → Reference Board + shot list → Safe Copy offload → Camera Match Lab load three bodies → RAW decoder setup + generate proxy → read the deltas and do-this list → Media Review picks → contact sheet + FCPXML export.
**Shorts hooks:** "Your RAW won't open in the match tool — fix it in one panel."; "Matching three camera brands without leaving the app."
**Audio:** organic Short/TikTok may use a trending sound; the YouTube walkthrough and the App Store preview use owned/licensed audio only.

---

## 5. Video capture — record once, reuse

**Master:** 2560×1600 · 60 fps · clean demo project · 60–120 s each · music-free · `cineflow-cap-<feature>-master.mov`.

| ✓ | Master | Covers |
|---|---|---|
| ☐ | `cineflow-cap-matchlab-master.mov` | Load 3 bodies → run analysis → deltas, confidence, do-this list |
| ☐ | `cineflow-cap-rawdecode-master.mov` | R3D → decoder-required state → Decoder Setup → point at REDline → Generate proxy → analysis completes |
| ☐ | `cineflow-cap-safecopy-master.mov` | Add card → verification queue runs → per-card report |
| ☐ | `cineflow-cap-review-master.mov` | Filmstrip → click to enlarge → flag picks → contact-sheet export |
| ☐ | `cineflow-cap-referenceboard-master.mov` | Add references → grid-mosaic export dialog → output |

| Destination | Size | Length | Format | Captions |
|---|---|---|---|---|
| App Store preview | 1920×1080 | 15–30 s | .mov H.264/ProRes | minimal, app-only |
| Storefront loop | 1600×1000 | 12–20 s | MP4, muted, loop | none |
| Docs embed | 1600×1000 | 8–20 s | MP4, muted | none |
| Reel / Story / Short / TikTok | 1080×1920 | 15–35 s | MP4 H.264+AAC | burned-in |
| X video | 1920×1080 | ≤2:20 | MP4 H.264+AAC | optional |
| YouTube walkthrough | 1920×1080 | 3–4 min | MP4 H.264+AAC | reviewed |

Rule: for 9:16, re-frame to the active panel — don't letterbox. Scrub any frame showing a real key or path.

---

## 6. Rollup

**Mac App Store** — ☐ subtitle + promo + keywords + description + What's New ☐ 10 new screenshots ☐ App Preview ☐ submit 1.0.8 metadata
**Storefront** — ☐ replace `cineflow` JSON entry ☐ hero + 6 stills + loop ☐ clear `badge`
**Docs** — ☐ 14 screenshots ☐ OG card + favicon ☐ markdown links carry `/cineflow/` ☐ rebuild + deploy
**Social** — ☐ IG carousel + caption ☐ Reel/Story ☐ X image + video + thread ☐ YouTube walkthrough + thumb ☐ Short/TikTok
**Masters** — ☐ 5 `cineflow-cap-*-master.mov`

---

## 7. Open decisions

- ☐ **Store Manager vs direct edit:** a Store Manager Publish rewrites `storeProducts.json`. Put the final §2.1 copy in the Store Manager `manifest.json`, or hand-edit `storeProducts.json` only *after* the last publish.
- ☐ **Storefront asset names:** migrate legacy `cineflow-*.png` gallery files to the canonical `.webp` names in §2.1, or keep legacy names and swap copy only.
- ☐ **`badge`:** clear to `""` (recommended — listing has been live since May 2026) or set `"UPDATED"`.
- ☐ **App Store screenshot localizations:** English only, or add others.
- ☐ **Audio track** for the App Store preview and YouTube walkthrough (owned/licensed).
- ☐ **Demo dataset:** build one clean fake project (fictional titles, no real paths) used across every capture.
- ☐ Add a `1.0.8` row to `docs/development/RELEASE_VERSIONS.md` **after** the actual App Store upload, per that log's rule.
