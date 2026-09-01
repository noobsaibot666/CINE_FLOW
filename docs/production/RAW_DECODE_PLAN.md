# Camera Match Lab — cinema RAW decode plan

**Problem:** analysing `.r3d` (and `.nev`, `.crm`/`.rmf`, `.xocn`, ARRIRAW) in Camera
Match Lab dead-ends with *"Vendor decoder required"* / *"BRAW SDK not available"* /
*"R3D is not supported"*. Even BRAW fails when the SDK framework isn't bundled in
the build. The user should never have to abandon the analysis.

## 1. Why each format fails today

| Ext | Family | Current classification (`production_media_capabilities.rs`) | Real blocker |
|---|---|---|---|
| `.braw` | Blackmagic | `vendor_decoded` → `braw_bridge` + `BlackmagicRawAPI.framework` | Bridge/SDK **not present in the build the user ran** (dev/CI). The path exists and works when bundled. |
| `.r3d` | RED | `vendor_decoded` → "REDline / RED R3D SDK" | **No R3D bridge is implemented.** Nothing consumes the SDK even if installed. |
| `.nev` | Nikon N-RAW | `vendor_decoded` → "REDline / RED R3D SDK" (label only) | Same — no bridge. (Now decodable via the RED SDK since Nikon acquired RED.) |
| `.crm` / `.rmf` | Canon Cinema RAW Light | `operator_proxy` (manual proxy only) | No decoder integrated. |
| `.xocn` | Sony X-OCN | `operator_proxy` | No decoder integrated. |
| `.ari` / RAW-in-MXF | ARRIRAW | `direct_original` for `.mxf` (optimistic) | FFmpeg has no ARRIRAW decoder; only ARRI's SDK or an NLE. |

## 2. What is actually available (GitHub / SDK research)

### Blackmagic RAW — **bundle it**
- The **Blackmagic RAW SDK is free, cross-platform, and carries no fee or
  restriction to integrate/redistribute inside an application**
  (blackmagicdesign.com/developer/products/braw). This is why `braw_bridge` +
  `Libraries/BlackmagicRawAPI.framework` already exists — it just has to ship.
- Reference headless decoders to align our bridge with / fork:
  `AkBKukU/braw-decode` (Linux, the original), `meisa233/braw-decode-macOS`
  (macOS fork), `NatronGitHub/openfx-braw` (reader used by Natron).
- **Action:** fix the build so the SDK framework + `braw_bridge` are always in
  the bundle (macOS `Contents/Resources/Libraries/` and next to the Windows
  exe), and add a Homebrew/`winget`-style fallback the app can offer to run.

### RED R3D / R3D NE / Nikon N-RAW — **user-installed SDK, app-assisted**
- No usable open-source full decoder. FFmpeg's `libavformat/r3d.c` only demuxes
  **pre-2015 R3D** (RED later scrambled the JPEG2000 headers); debayer maths are
  proprietary.
- **RED R3D SDK is a free download** (reddigitalcinema.com/download/r3d-sdk),
  macOS/Windows/Linux, GPU-accelerated, ships the **REDline** CLI. Proprietary
  licence — **cannot be redistributed**; the user downloads it once.
- **N-RAW decode is being folded into the RED SDK** (Nikon owns RED), so one
  "RED family" provider covers `.r3d`, `.r3d` NE, and `.nev`.
- Integration references: `wang-bin/mdk-r3d` (RED SDK → libmdk plugin, clean
  example of wrapping the SDK), `arunabhcode/RedSDK` (SDK header mirror).
- **Action:** ship a small `red_bridge` (like `braw_bridge`) that links the
  R3D SDK **at runtime** from a user-chosen install dir; when absent, the app
  shows a one-click "Get the free RED SDK" flow (download link + where to point
  us) instead of failing.

### Canon Cinema RAW Light (`.crm`/`.rmf`)
- No FFmpeg decoder (`codec none (CRAW)`); needs Canon's Cinema RAW Development
  library or an NLE. No redistributable free SDK.
- **Action:** treat as "provider: Resolve or operator proxy" (below).

### Sony X-OCN (`.xocn` / X-OCN-in-MXF)
- No FFmpeg decoder. Sony Catalyst / RAW Viewer only.
- **Action:** same — "provider: Resolve or operator proxy".

### ARRIRAW
- ARRI SDK or an NLE. `.ari` and RAW-in-MXF.
- **Action:** same — "provider: Resolve or operator proxy". Also stop
  classifying every `.mxf` as `direct_original`; probe the codec first.

### DaVinci Resolve — **the universal fallback for the ones we can't bundle**
- The **free** DaVinci Resolve decodes R3D, BRAW, CRM, X-OCN, ARRIRAW and N-RAW
  natively and can be driven headless via its scripting API
  (`Resolve` / `fusionscript`, already used elsewhere in this repo — see the
  `resolve-*` skills). Many target users already have it installed.
- **Action:** detect an installed Resolve and offer "Build analysis proxy with
  DaVinci Resolve" as a decode provider for any format we can't do natively.

### ProRes RAW — **now free via FFmpeg 8**
- FFmpeg 8.0 added **native ProRes RAW decoding**. Nikon ZR, Panasonic, and
  external recorders can output it. **Action:** once FFmpeg is bumped to 8,
  route ProRes RAW straight through `direct_original`.

## 3. Proposed architecture

### 3.1 A decode-provider layer (`production_raw_decode.rs`)
One enum of providers, each with a `probe() -> ProviderStatus` and a
`make_analysis_proxy(src, out) -> Result`:

| Provider | Covers | Bundled? |
|---|---|---|
| `Ffmpeg` (direct) | MOV/MP4/MXF-video, DNG/ARW/CR3/NEF… via LibRaw, ProRes RAW (ffmpeg 8) | yes |
| `BrawSdk` (`braw_bridge`) | `.braw` | **yes — must be fixed in CI** |
| `RedSdk` (`red_bridge` / REDline) | `.r3d`, R3D NE, `.nev` | no — user installs, app-assisted |
| `Resolve` (headless render) | R3D, BRAW, CRM, X-OCN, ARRIRAW, N-RAW | no — user has it, app detects |
| `OperatorProxy` | anything — last resort | n/a |

`classify_media_source` returns the **ordered list of providers that could
service this file** plus each one's live status, instead of a single
`recommended_proxy_tool` string.

### 3.2 `production_decoder_status` command + **Decoder Setup** panel
A new command returns, per family: `available | needs_setup | unavailable`, the
detected version/path, and a `setup` blob (`download_url`, `install_steps[]`,
`locate_action`). A **Decoder Setup** panel (reachable from the Match Lab
"Camera source import" card and from any blocked slot) renders:

- a status row per format (BRAW ✓ bundled, RED ⚠ needs SDK, Resolve ✓ detected…),
- **"Download"** buttons opening the official pages
  (`shell.open` — RED SDK, BRAW installer, Resolve),
- **"Locate…"** file pickers to point the app at an existing SDK/app install,
  persisted in settings,
- copy-paste install steps (incl. the Homebrew one-liner for `braw-decode`),
- a **"Re-check"** button.

### 3.3 Blocked-slot UX — never a dead end
When a slot's source needs a provider that isn't ready, the slot shows, in
priority order:
1. **"Decode with DaVinci Resolve"** (if detected) — one click, no user setup.
2. **"Set up <SDK>"** → opens Decoder Setup focused on that format.
3. **"Attach MP4/ProRes proxy…"** (today's escape hatch, kept).

The Analyze button stays enabled; slots that still can't decode are marked
`provisional` in the run (already modelled) rather than aborting the batch.

## Status (implemented)

- **Phase 1 done** — `verify_macos_v12_runtime.mjs` now requires
  `BlackmagicRawAPI.framework`; `locate_braw_decoder` also accepts the
  Windows `.dll` / Linux `.so`.
- **Phase 2 done** — `production_decoder_status` module + commands + the
  `decoder_status` field on the capability report.
- **Phase 4 done** — Decoder Setup panel + blocked-slot UX in Camera Match Lab.
- **Phase 5 done** — `create_red_proxy_via_redline` (REDline: quarter-res
  ProRes → ffmpeg proxy) covers `.r3d` / `.r3d` NE / `.nev`. `locate_redline`
  finds `red_bridge` / `REDline` on PATH or in the configured RED SDK folder.
  *Caveat:* REDline flag set (`--decodeRes 2 --proResEncoding 0 --resizeX 1920`)
  is tuned for current REDline; verify against the installed SDK version.
- **Phase 3 done (best-effort)** — `production_resolve_decode` drives a
  running DaVinci Resolve via a Python script to render an mp4 proxy for
  `.crm` / `.rmf` / `.xocn` / `.ari`. *Caveats:* Resolve must be **open**
  (free edition only scripts a live instance); needs `python3` with the
  `DaVinciResolveScript` module reachable via `RESOLVE_SCRIPT_API` /
  `RESOLVE_SCRIPT_LIB` (defaults set per-OS, overridable by env). Every
  failure returns an actionable message and the attach-proxy fallback still
  applies.
- **Phase 6 (FFmpeg 8 / ProRes RAW)** — not started.

`ensure_matchlab_proxy_internal` now picks a `RawProxyPlan`
(Braw / Redline / Resolve / Unavailable) up front; `Unavailable` fails with
guidance instead of a generic error, and never blocks the Analyze batch.

## 4. Phased plan

1. **Unblock BRAW (build fix).** Ensure `braw_bridge` + `BlackmagicRawAPI.framework`
   ship in every macOS/Windows bundle; add a post-build check that fails the
   build if the framework is missing. Add the Homebrew/`braw-decode` fallback
   probe to the offer list. *(No new UI — this alone clears one of the three
   screenshot errors.)*
2. **Decoder-provider layer + status command.** Refactor
   `production_media_capabilities` to the provider model; add
   `production_decoder_status`; keep behaviour identical where a provider
   already exists.
3. **Resolve provider.** Detect Resolve, drive a headless proxy render for
   R3D/CRM/X-OCN/ARRIRAW/N-RAW. This is the big single win — covers every main
   brand with software the user likely already has.
4. **Decoder Setup panel + blocked-slot UX.** The download/locate/re-check UI.
5. **RED `red_bridge`.** Native R3D/N-RAW via a user-located RED SDK (fork
   `wang-bin/mdk-r3d` as the integration reference). GPU-accelerated, no Resolve
   round-trip.
6. **FFmpeg 8 bump.** Native ProRes RAW; re-test all `direct_original` paths.

## 5. Keeping the feature alive

- **CI gate:** a build step that asserts every bundled decoder binary + its SDK
  runtime is present and runs a 1-frame smoke decode on a tiny checked-in
  sample per bundled format. Fail the release if any regress.
- **Version pinning:** record BRAW SDK / FFmpeg / bridge versions in
  `docs/development/` and bump deliberately.
- **`docs/` runbook** for regenerating each bridge (build flags, SDK download,
  where files go in the bundle) so a broken decoder is a 30-minute fix, not an
  archaeology dig.
- **Telemetry-free self-check:** the Decoder Setup panel's "Re-check" is the
  user-facing health check; surface it in About / Settings too.

## Licences (redistribution)

| SDK | Redistribute in-app? | Source |
|---|---|---|
| Blackmagic RAW SDK | **Yes**, free, no fee | blackmagicdesign.com/developer/products/braw |
| RED R3D SDK | **No** — free download, user installs | reddigitalcinema.com/download/r3d-sdk |
| Canon / Sony / ARRI RAW | No free redistributable SDK | vendor tools / NLE |
| DaVinci Resolve | Not bundled — detected on the user's machine | blackmagicdesign.com |
| LibRaw | Yes (LGPL/CDDL dual) — already used | — |
| FFmpeg | Yes (LGPL build) — already used | — |
