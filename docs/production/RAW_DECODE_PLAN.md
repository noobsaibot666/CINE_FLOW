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
| `.ari` / `.arx` | ARRIRAW | `vendor_decoded` → ARRI ART / Resolve | FFmpeg has no ARRIRAW decoder. Decoded by `art-cmd` (free ARRI Reference Tool) or Resolve. |
| ARRIRAW `.mxf` | MXF (reactive) | `direct_original` until frame extraction fails | Then escalates to the ARRI ART / Resolve proxy path (`is_arri_mxf_container_path`). |

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
- ARRI SDK or an NLE. `.ari`/`.arx` and ARRIRAW MXF.
- **Done (ARRI ART provider):** `art-cmd`, the CLI of the free **ARRI Reference
  Tool**, decodes ARRIRAW and ARRIRAW MXF natively — no Resolve needed. It's the
  ARRI analogue of REDline: `locate_art_cmd` finds an install (operator-set
  `art_cmd_dir`, the standard `/Applications/ARRI Reference Tool.app`, or PATH),
  `create_arri_proxy_via_art_cmd` runs
  `art-cmd process --input <src> --video-codec prores422 --output <mov>` and
  ffmpeg re-encodes to the shared proxy. Decoder Setup family `ARRIRAW`,
  provider `arri_art`, falls back to Resolve, then guides to the free download.
  Not bundled — user-installed, same model as REDCINE-X PRO for R3D.
- ARRIRAW **MXF** still classifies as `MXF` / direct until ffmpeg fails to pull a
  frame (`codec_name=unknown`, 0×0), then the slot escalates to the ART/Resolve
  proxy path (`is_arri_mxf_container_path`).

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
- **Phase 6 done** — the bundled FFmpeg is already **8.0.1**, which decodes
  Apple ProRes RAW natively, so `.mov`/`.mxf` ProRes RAW analyses through the
  normal `direct_original` path with no extra work. `probe_prores_raw`
  reports it Ready; `verify_macos_v12_runtime.mjs` now fails the build if the
  bundled FFmpeg drops below 8; the source-support strip lists ProRes RAW
  under "Direct video".

### Implementation review — fixes applied

A review of the wiring turned up and fixed:
- **Front/back mismatch** — `isDecoderBackedRawClip` in the UI only knew
  `.braw`, so `.r3d`/`.crm`/`.xocn` bypassed the Generate-proxy gate and
  auto-decoded on Analyze. It now mirrors the Rust `is_decoder_backed_raw_path`
  (braw + r3d/nev + crm/rmf/xocn).
- **`source_kind` mislabel** — a RED/Resolve-decoded clip was tagged
  `"original"`; now anything where the analysed path differs from the clip is
  `"proxy"`.
- **Post-failure cooldown** — the 120 s "proxy recently failed" lock blocked
  the intended "open Resolve and retry" loop; an explicit
  `production_matchlab_ensure_proxy` call now bypasses it.
- **REDline flags** — `--format` is an enum: `3` is **JPEG**, not ProRes, so the
  old command produced a `.jpg` sequence and the step reported "REDline produced
  no .mov output". Fixed to `--format 201` (Apple ProRes → `<base>.mov`), plus
  `--useMeta` (apply the clip's RMD/embedded look) and `--resizeX 1920` (small
  intermediate). Verified against REDline Build 65. ffmpeg still does the final
  encode via the shared `encode_analysis_proxy`.
- **BRAW pipe dimensions** — `build_braw_ffmpeg_input_args` took the frame size
  from **ffprobe** (container/sensor size, e.g. 6176×3472) while `braw_bridge`
  decodes to the SDK active-image size (e.g. 6144×3456). The mismatch mis-framed
  every raw frame → ffmpeg "No filtered frames" → empty output → SIGPIPE made
  braw_bridge look crashed. It now reads dimensions from `braw_bridge --info`
  and only falls back to ffprobe.
- **Resolve runner** — prefers Resolve's own `fuscript` (Python + modules
  preloaded, no env/`python3` needed); falls back to system `python3` with
  `RESOLVE_SCRIPT_*`; errors clearly if neither exists.
- **ARRIRAW** — new **ARRI ART** decode provider (`art-cmd`, native, no Resolve).
  `.ari`/`.arx` route through it directly; ARRIRAW **MXF** stays "direct" until
  ffmpeg fails to extract a frame (`codec_name=unknown`, 0×0), then
  `is_arri_mxf_container_path` lets `production_matchlab_ensure_proxy` route it
  through ART (preferred) or a running Resolve. The error card shows **Generate
  proxy (ARRI Reference Tool / DaVinci Resolve)** when one is available, else an
  install/attach-a-proxy hint. `art-cmd` is user-installed, not bundled.

### Known caveats still open

- **No open-source R3D decoder exists and none can be bundled.** FFmpeg's
  `libavformat/r3d.c` only demuxes the container, RED scrambled the JPEG2000
  headers years ago, and RED does not permit shipping their codec with FFmpeg.
  The `github.com/arunabhcode/RedSDK` repo is just a header mirror of RED's own
  SDK, not an independent implementation. So RED decode will always require
  RED's own tooling or DaVinci Resolve — there is nothing to fork.
- The bundled `REDline-aarch64-apple-darwin` sidecar is an **x86_64** binary
  (runs under Rosetta). Rather than chase a native build, `locate_redline` now
  **prefers a REDline from a REDCINE-X PRO / standalone install** (which is
  native Apple Silicon) and from the operator's configured RED SDK folder, and
  only falls back to the bundled sidecar. `red_setup()` points users at
  REDCINE-X PRO (free, native) as the primary route, the R3D SDK as the
  alternative, and Resolve as the no-install path. `verify_macos_v12_runtime.mjs`
  still warns about the bundled binary's arch.
- The bundled `src-tauri/bin/REDline-*` sidecars are **non-functional** on
  Apple Silicon: they are x86_64 with an invalid embedded code signature (AMFI
  SIGKILLs them, exit 137) and depend on ~10 unbundled `@rpath` dylibs
  (MediaProcessor, Qt5 frameworks, DNxHR, log4cplus, mpg123). R3D decode
  therefore requires a real REDCINE-X PRO / standalone REDline install —
  `locate_redline` finds the `/usr/local/bin/REDline` symlink it drops.
- The Resolve render preset (`SetCurrentRenderFormatAndCodec("mp4", "H264")`)
  is still unverified against every Resolve version.
- **ARRI `art-cmd` flags unverified against a live install.** The invocation
  (`process --input … --video-codec prores422 --output …`) is taken from ARRI's
  published `art-cmd` v1.0 manual, not tested here (ART wasn't installed on the
  dev machine). `create_arri_proxy_via_art_cmd` accepts the named output file
  *or* any `.mov`/`.mxf` art-cmd leaves in the scratch dir, and surfaces
  stderr + a Decoder Setup hint on failure. Verify the flag set and whether ART
  needs activation when a real install is available.

### Explicit proxy generation (operator control)

Provider-backed sources (BRAW / RED / Resolve) no longer auto-decode on
Analyze. The slot shows a **Generate proxy** button; clicking it confirms
(naming the provider and warning it may take minutes / that Resolve must be
open), runs `production_matchlab_ensure_proxy` as a visible job, and caches
the result against the current clip. Analyze skips a provider-backed slot
that has neither a generated nor an attached proxy, with a "click Generate
proxy" message — it never silently starts a long decode.

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
