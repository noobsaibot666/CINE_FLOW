# Camera Match Lab — analysis review

Review of the measurement + confidence pipeline in
`src-tauri/src/production_match_lab.rs`, with the changes made in this pass and
the work still open.

## Pipeline, as built

1. **`analyze_frame`** — opens each extracted frame (8-bit RGB PNG/JPEG),
   builds luma + per-channel histograms, and derives medians for the full
   frame, a midtone band, and a skin band, plus highlight / midtone / shadow
   pixel fractions.
2. **`aggregate_frames`** — medians across the sampled frames, plus per-metric
   variance (used as a stability signal).
3. **`build_measurement_bundle`** — turns the aggregate into false-color bands,
   RGB balance deltas (R−G, B−G at full / midtone / skin), and a
   green–magenta hint.
4. **`compute_production_match_confidence`** — a 0–100 heuristic scoring how
   *trustworthy* the measurement is (not how close two cameras are). Starts at
   96 and subtracts penalties for: proxy vs. original decode, missing source
   profile, color-transform status, untrusted metrics, proxy-validation
   warnings, chart detection, calibration quality, clipped chart patches, and
   low frame count.

The per-camera exposure / white-balance / monitoring *targets* are not in this
file — they live in `src/components/Production/productionLogic.ts`, keyed by
**signal profile** (LogC, S-Log3, V-Log, …), so every body sharing a signal
profile inherits the same deterministic targets. Adding a camera body only
needs the correct `signalProfile` + base ISO list.

## Changes made in this pass

### Skin sampling is now chroma-gated (`analyze_frame`)
Previously the skin band was a bare luma window (0.45–0.64) with no color
gate, so grey walls, sky, and pavement landed in the skin medians and skewed
the skin white-balance delta. It now also requires warm chroma — `R ≥ G ≥ B`,
`R − B ≥ 6`, saturation in `0.08…0.55` — and the luma window was widened to
0.35–0.72 because the chroma gate now does the discriminating. This makes the
`skin_red_vs_green` / `skin_blue_vs_green` deltas reflect actual faces.

### Highlight / clip thresholds named and separated
`highlight_percent` used a bare `> 0.95`; "clipped" elsewhere reads the
248/255 histogram bins. They are now explicit: `HIGHLIGHT_LUMA = 0.90`
("up in the highlights"), with hard clipping still tracked separately from the
top histogram bins in `build_measurement_bundle`.

### Confidence: fairer chart handling + an evidence floor
- "No chart shot" (`chart_detected: None`) is a legitimate field workflow and
  now costs −10, not −16; a chart that is present but unreadable
  (`Some(false)`) still costs −28.
- New **evidence floor**: when the decode is original/vendor, a color
  transform was applied, metrics are trusted, there are no clipped patches,
  and ≥ 8 frames were sampled, the score cannot fall below 78 on chart
  absence alone. A weak analysis (e.g. operator proxy) still scores below the
  floor. Covered by `confidence_has_evidence_floor_for_chartless_but_solid_analysis`
  and `confidence_not_attempted_chart_beats_failed_chart`.

## Still open

- **8-bit, display-referred input.** `analyze_frame` works on an extracted
  frame that may already carry a Rec.709 view transform. The confidence model
  accounts for *whether* a transform was applied, but the metrics themselves
  are not log-linearised, so two cameras compared through different view
  transforms will show deltas that are partly grade, not sensor. A log-aware
  path (analyse in the camera's transfer curve, or a common linear space)
  would make the deltas physically meaningful.
- **Inter-frame stability is computed but unused by the score.**
  `aggregate_frames` produces `luma_variance`, `red/green/blue_variance`, etc.
  Feeding a normalised stability term into `compute_production_match_confidence`
  would catch shots where the medians are unreliable (camera move, a cut in
  the sample window, exposure ramp).
- **Metadata corroboration.** Camera ISO / white-balance metadata is carried
  in the measurement bundle but not cross-checked against the measured
  exposure / balance; agreement there is strong positive evidence.
- **Skin gate is heuristic.** The warm-chroma test is a reasonable filter but
  not a skin-probability model; very warm sets or heavy gels can still leak.
  A small hue-angle + luma joint prior would tighten it.
