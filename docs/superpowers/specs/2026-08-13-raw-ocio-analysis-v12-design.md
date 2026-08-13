# CineFlow V1.2 RAW/OCIO Analysis Pipeline Design

## Purpose

CineFlow V1.2 should move from capability labels and provenance into a real RAW/OCIO analysis pipeline. The goal is to make the best available camera data accessible to Look Setup, Camera Match Lab, and Match & Normalize, then run measurements in a controlled color-managed space.

This is not a promise that every proprietary cinema RAW file can be decoded natively. The design separates open RAW decode, vendor-backed cinema RAW decode, operator proxies, OCIO transforms, and confidence scoring so the application can improve analysis quality without making false claims about unsupported formats.

## Recommended Strategy

Build the pipeline in two parallel tracks:

1. **Open RAW + OCIO Core first**
   - Add LibRaw-based ingest for still/camera RAW families such as `.nef`, `.cr2`, `.cr3`, `.arw`, `.raf`, and `.dng`.
   - Add the OCIO execution layer and validate source profile to ACES transforms.
   - Use this track to prove metadata extraction, transform execution, normalized analysis, and provenance.

2. **Cinema RAW adapter framework in parallel**
   - Keep BRAW as the first vendor-backed path because the app already has BRAW sidecars.
   - Formalize REDline/R3D and Nikon N-RAW probing as a vendor adapter.
   - Add proxy-guided adapters for Sony X-OCN, Canon Cinema RAW Light, and ProRes RAW until legally clean decode paths are confirmed.

This sequence gives CineFlow a working RAW data path quickly while preserving a clean architecture for cinema RAW expansion.

## Why This Direction

OpenColorIO is the color transform engine. It can load configs, build processors, and apply CPU/GPU transforms, but it does not decode proprietary camera RAW. LibRaw is designed for embedding RAW decoding and retrieving data needed for RAW conversion. RawSpeed is useful as a low-level decode reference, but it explicitly does not demosaic or color-correct, so it is not the first choice for a complete ingest path.

The working model is:

```text
camera source
  -> decode adapter
  -> raw metadata report
  -> source profile selection
  -> OCIO transform to ACES analysis space
  -> measurements
  -> confidence/provenance
  -> Match & Normalize output
```

## Substantial Feature Options

### Option A: LibRaw + OCIO Core

Add open RAW ingest with LibRaw and execute OCIO transforms for supported source profiles.

Benefits:
- immediately improves access to Nikon, Canon, Sony, Fuji, Panasonic, and DNG still/camera RAW files
- provides real RAW metadata for analysis
- creates the core transform path needed by all future cinema RAW work

Tradeoffs:
- does not solve proprietary cinema RAW formats by itself
- requires careful packaging and license review

Recommendation: implement first.

### Option B: Cinema RAW Vendor Adapter Sprint

Prioritize BRAW, REDline/R3D, Nikon N-RAW, Sony X-OCN, Canon CRM/RMF, and ProRes RAW adapters.

Benefits:
- closer to high-end cinema camera workflows
- makes Camera Match Lab more useful for production sets

Tradeoffs:
- vendor SDK licensing and redistribution rules vary
- some formats may remain proxy-guided only
- more failure modes before the app has a complete OCIO execution layer

Recommendation: design now, implement after the core OCIO path is proven.

### Option C: Proxy-First Professional Workflow

Do not add native RAW decode yet. Improve proxy validation, metadata sidecars, source profile selection, and OCIO transforms around operator-created proxies.

Benefits:
- lowest legal and packaging risk
- useful for teams already using Resolve, Catalyst, Canon tools, REDline, or NLE transcodes

Tradeoffs:
- less substantial than true RAW access
- still depends on external tools for the best data

Recommendation: keep as fallback, not the main V1.2 investment.

## V1.2 Architecture

### RAW Ingest Layer

Create a backend ingest layer with one adapter interface:

```text
RawIngestAdapter
  can_probe(path) -> capability
  extract_metadata(path) -> RawMetadataReport
  decode_preview_frame(path, request) -> DecodedFrame
  decode_analysis_frames(path, request) -> Vec<DecodedFrame>
```

Initial adapters:

- `FfmpegVideoAdapter`: existing MP4/MOV/MXF/H.264/H.265/HEVC path
- `LibRawStillAdapter`: open RAW still/camera formats
- `BrawAdapter`: existing BRAW bridge formalized behind the same interface
- `RedlineAdapter`: vendor CLI adapter for R3D/Nikon N-RAW where installed and allowed
- `OperatorProxyAdapter`: user-selected proxy with original-source relationship

Proxy-guided placeholders:

- `SonyXocnProxyGuide`
- `CanonCinemaRawProxyGuide`
- `ProResRawProxyGuide`

### RAW Metadata Report

Add a structured report that can be saved with each source:

```text
source_path
decoder_family
decoder_version
raw_format_family
camera_make
camera_model
camera_serial
lens_model
iso
shutter
aperture
white_balance
wb_multipliers
cfa_pattern
black_level
white_level
bit_depth
active_area
color_matrix
embedded_color_profile
timecode
warnings
```

Missing fields must be explicit. Unknown data should not be guessed.

### OCIO Execution Layer

Create an OCIO backend layer separate from profile metadata:

```text
OcioConfigReport
  config_path
  config_version
  roles
  color_spaces
  displays
  validation_status
  warnings

OcioTransformReport
  source_profile_id
  source_color_space
  analysis_color_space
  transform_status
  processor_cache_id
  warnings
```

Start with CPU transforms. GPU/shader extraction can be added after the CPU path is verified.

Target analysis spaces:

- `ACEScg` for scene-linear numeric analysis and chart transforms
- `ACEScct` for UI-facing grading-style comparison and Match & Normalize language

### Source Profile Selection

Source profile confidence should come from:

1. explicit camera mode profile selected in Look Setup
2. RAW metadata or video metadata
3. filename/card structure hints
4. manual user override

The UI should show whether the profile is:

- `detected`
- `camera_mode_default`
- `manual_override`
- `missing`

### Analysis Integration

Camera Match Lab should choose the highest-quality available path:

1. native/open RAW decoded frame
2. vendor-decoded RAW frame or vendor-generated proxy
3. original video source
4. camera proxy
5. operator proxy

Frames should carry:

- original decode path
- raw metadata report id
- source profile id
- OCIO transform report id
- analysis color space
- confidence inputs

### Confidence Model Upgrade

The existing 0-100 confidence model should add:

- RAW decoder availability
- decoder metadata completeness
- source profile certainty
- OCIO config validation
- transform status
- source bit depth
- proxy generation path
- chart quality
- clipping/crushing
- frame count

Confidence labels remain:

- `85-100 high`
- `65-84 usable`
- `40-64 caution`
- `0-39 low trust`

## Roadmap

### Phase 1: Dependency and License Lock

Outcome: decide what ships embedded and what remains external.

Tasks:
- document LibRaw license obligations and packaging constraints
- document OCIO packaging strategy and config source
- document BRAW, REDline, Sony, Canon, and ProRes RAW adapter constraints
- create a support matrix with `native`, `vendor`, `proxy`, and `unsupported` tiers

### Phase 2: RAW Ingest Interface

Outcome: all decoders fit one backend contract.

Tasks:
- create `src-tauri/src/production_raw_ingest.rs`
- add adapter traits/types
- move existing FFmpeg/BRAW capability logic behind the ingest interface
- expose a Tauri command for raw ingest capability reports
- add Rust unit tests for adapter selection

### Phase 3: LibRaw Still/Camera RAW Adapter

Outcome: CineFlow can read RAW metadata and decoded analysis frames from open camera RAW formats.

Tasks:
- add LibRaw dependency or sidecar strategy
- implement metadata extraction
- implement representative frame decode
- persist `raw_metadata_json`
- add tests using fixtures or parser stubs

### Phase 4: OCIO Config and Transform Execution

Outcome: CineFlow can validate OCIO config and transform pixels into ACES analysis space.

Tasks:
- add `src-tauri/src/production_ocio.rs`
- add config discovery/bundling
- validate config with OCIO APIs or tool output
- execute CPU transforms
- store transform reports with processor/cache ids
- test source profile to ACES transform success/failure

### Phase 5: Camera Match Lab Integration

Outcome: analysis uses decoded and OCIO-normalized frames when available.

Tasks:
- route selected sources through the ingest interface
- attach raw metadata and OCIO transform reports to analysis frames
- upgrade confidence scoring inputs
- display decoder, OCIO config, source profile, and analysis space per slot
- save provenance with Match Lab runs

### Phase 6: Match & Normalize Integration

Outcome: normalization output is based on the best available decoded/OCIO-normalized evidence.

Tasks:
- consume raw metadata and transform reports from saved Match Lab runs
- include OCIO/RAW provenance in steps and exports
- warn when selected run lacks normalized ACES analysis
- include confidence reasons in PDF export

### Phase 7: Cinema RAW Adapters

Outcome: vendor and proxy-guided cinema RAW support expands without changing the app contract.

Tasks:
- formalize BRAW adapter
- add REDline/R3D/Nikon N-RAW probe and decode/proxy adapter
- add Sony X-OCN proxy-guide adapter
- add Canon CRM/RMF proxy-guide adapter
- add ProRes RAW proxy-required classification

### Phase 8: Approved Public Documentation

Outcome: public Astro docs describe only completed behavior.

Tasks:
- update media processing docs after each approved decode/OCIO feature ships
- update production user guide with final user workflows
- keep active adapter limitations in internal docs until approved

## Acceptance Criteria

V1.2 should be considered successful when:

- at least one open RAW family can produce a raw metadata report and decoded analysis frame
- OCIO config validation is visible in the app
- at least one source profile can be transformed into ACES analysis space
- Camera Match Lab stores raw metadata and OCIO transform provenance
- Match & Normalize exports include RAW/OCIO evidence and confidence
- unsupported proprietary RAW formats clearly request vendor/proxy paths

## Non-Goals

- Do not promise native decode for every proprietary cinema RAW format.
- Do not build a full color grading engine.
- Do not replace Resolve, Catalyst, Canon RAW Development, REDline, or vendor SDKs.
- Do not publish public Astro docs for unshipped adapters.

## External References

- OpenColorIO processors/API: https://opencolorio.readthedocs.io/en/latest/api/processors.html
- OpenColorIO tools and config usage: https://opencolorio.readthedocs.io/en/stable/guides/using_ocio/using_ocio.html
- OpenColorIO ACES 2.0 support: https://opencolorio.org/
- LibRaw documentation and licensing: https://www.libraw.org/docs
- RawSpeed scope and licensing: https://github.com/darktable-org/rawspeed

## Self-Review

- Placeholder scan: no TBD/TODO placeholders remain.
- Scope check: V1.2 is decomposed into RAW ingest, OCIO execution, analysis integration, and adapter expansion phases.
- Public docs rule: Astro docs are reserved for approved shipped behavior only.
- Risk check: proprietary RAW limitations are explicit and proxy/vendor paths remain first-class.
