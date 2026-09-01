import { deriveSourceProfileId, type ProductionSourceProfileId } from "./sourceProfiles";

export type CameraBrand = "ARRI" | "Blackmagic" | "Canon" | "Fujifilm" | "Nikon" | "Panasonic" | "RED" | "Sony";
export type SignalProfile =
  | "BMD_FILM_GEN5"
  | "C_LOG2"
  | "F_LOG2"
  | "LOG_C"
  | "N_LOG"
  | "REC709"
  | "RED_IPP2"
  | "S_LOG3"
  | "V_LOG";

export const LENS_CHARACTER_OPTIONS = [
  "Neutral Cine",
  "Vintage Soft",
  "Clean Modern",
  "High Contrast",
  "Lower Contrast",
  "Anamorphic",
  "Spherical",
] as const;

export const DIFFUSION_OPTIONS = [
  "None",
  "Black Pro-Mist 1/8",
  "Black Pro-Mist 1/4",
  "Black Pro-Mist 1/2",
  "Glimmerglass 1",
  "Glimmerglass 2",
  "Hollywood Black Magic 1/8",
  "Hollywood Black Magic 1/4",
] as const;

export interface ModeProfile {
  id: string;
  label: string;
  sourceId: string;
  capture: {
    logName?: string;
    rawName?: string;
    codecOptions?: string[];
    quickLabel: string;
    signalProfile?: SignalProfile | null;
    sourceProfileId?: ProductionSourceProfileId | null;
  };
  baseISO: number[];
  texture: {
    sharpening: string;
    noiseReduction: string;
  };
  notes?: string;
}

export interface CameraProfile {
  profileId: string;
  brand: CameraBrand;
  model: string;
  modes: ModeProfile[];
  notes?: string;
}

function buildMode(
  profileId: string,
  id: string,
  label: string,
  quickLabel: string,
  signalProfile: SignalProfile | null,
  baseISO: number[],
  codecOptions: string[],
  extras?: { logName?: string; rawName?: string; notes?: string },
): ModeProfile {
  return {
    id,
    label,
    sourceId: `${profileId}_${id}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
    capture: {
      logName: extras?.logName,
      rawName: extras?.rawName,
      codecOptions,
      quickLabel,
      signalProfile,
      sourceProfileId: deriveSourceProfileId(signalProfile, extras?.logName),
    },
    baseISO,
    texture: {
      sharpening: "OFF",
      noiseReduction: "Low/Off",
    },
    notes: extras?.notes,
  };
}

function buildProfile(
  profileId: string,
  brand: CameraBrand,
  model: string,
  notes: string,
  modes: ModeProfile[],
): CameraProfile {
  return { profileId, brand, model, notes, modes };
}

const CAMERA_PROFILES: CameraProfile[] = [
  buildProfile("PROFILE_ARRI_ALEXA_MINI_LF", "ARRI", "Alexa Mini LF", "ARRI large-format baseline with strong LogC monitoring discipline.", [
    buildMode("PROFILE_ARRI_ALEXA_MINI_LF", "arriraw-logc", "ARRIRAW / LogC", "ARRIRAW LogC", "LOG_C", [800], ["ARRIRAW"], { logName: "LogC", rawName: "ARRIRAW", notes: "Use a technical viewing transform before creative taste." }),
    buildMode("PROFILE_ARRI_ALEXA_MINI_LF", "prores-logc", "ProRes 4444 XQ / LogC", "LogC", "LOG_C", [800], ["ProRes 4444 XQ"], { logName: "LogC" }),
  ]),
  buildProfile("PROFILE_ARRI_ALEXA_35", "ARRI", "Alexa 35", "ARRI LogC4 body with wide highlight protection.", [
    buildMode("PROFILE_ARRI_ALEXA_35", "arriraw-logc4", "ARRIRAW / LogC4", "ARRIRAW LogC4", "LOG_C", [800], ["ARRIRAW"], { logName: "LogC4", rawName: "ARRIRAW" }),
    buildMode("PROFILE_ARRI_ALEXA_35", "prores-logc4", "ProRes 4444 XQ / LogC4", "LogC4", "LOG_C", [800], ["ProRes 4444 XQ"], { logName: "LogC4" }),
  ]),
  buildProfile("PROFILE_SONY_FX3", "Sony", "FX3", "Compact Sony body. Keep S-Log3 exposure disciplined.", [
    buildMode("PROFILE_SONY_FX3", "xavc-slog3", "XAVC-I / S-Log3", "S-Log3", "S_LOG3", [800, 12800], ["XAVC-I"], { logName: "S-Log3" }),
  ]),
  buildProfile("PROFILE_SONY_FX6", "Sony", "FX6", "Dual-base Sony cine body with stable S-Log3 pipeline.", [
    buildMode("PROFILE_SONY_FX6", "xavc-slog3", "XAVC-I / S-Log3", "S-Log3", "S_LOG3", [800, 12800], ["XAVC-I"], { logName: "S-Log3" }),
  ]),
  buildProfile("PROFILE_SONY_FX9", "Sony", "FX9", "Full-size Sony cine body with S-Log3 and dual-base ISO.", [
    buildMode("PROFILE_SONY_FX9", "xavc-slog3", "XAVC-I / S-Log3", "S-Log3", "S_LOG3", [800, 4000], ["XAVC-I"], { logName: "S-Log3" }),
  ]),
  buildProfile("PROFILE_SONY_VENICE", "Sony", "Venice", "Sony Venice with technical S-Log3 baseline.", [
    buildMode("PROFILE_SONY_VENICE", "xocn-slog3", "X-OCN / S-Log3", "X-OCN S-Log3", "S_LOG3", [500, 2500], ["X-OCN"], { logName: "S-Log3", rawName: "X-OCN" }),
  ]),
  buildProfile("PROFILE_CANON_C70", "Canon", "C70", "Canon Super 35 body. Keep C-Log3 clean and simple.", [
    buildMode("PROFILE_CANON_C70", "xfavc-clog3", "XF-AVC / C-Log3", "C-Log3", "C_LOG2", [800], ["XF-AVC"], { logName: "C-Log3" }),
  ]),
  buildProfile("PROFILE_CANON_C300III", "Canon", "C300 Mark III", "Canon cinema body with dual-gain output and log capture.", [
    buildMode("PROFILE_CANON_C300III", "xfavc-clog2", "XF-AVC / C-Log2", "C-Log2", "C_LOG2", [800], ["XF-AVC"], { logName: "C-Log2" }),
  ]),
  buildProfile("PROFILE_CANON_C500II", "Canon", "C500 Mark II", "Full-frame Canon body with strong C-Log2 baseline.", [
    buildMode("PROFILE_CANON_C500II", "cinemaraw-clog2", "Cinema RAW Light / C-Log2", "RAW C-Log2", "C_LOG2", [800], ["Cinema RAW Light"], { logName: "C-Log2", rawName: "Cinema RAW Light" }),
  ]),
  buildProfile("PROFILE_PANASONIC_S1H", "Panasonic", "S1H", "Mirrorless V-Log body. Protect highlights before chasing density.", [
    buildMode("PROFILE_PANASONIC_S1H", "all-i-vlog", "ALL-I / V-Log", "V-Log", "V_LOG", [640, 4000], ["ALL-I"], { logName: "V-Log" }),
  ]),
  buildProfile("PROFILE_PANASONIC_GH6", "Panasonic", "GH6", "Micro four-thirds V-Log body with compact highlight headroom.", [
    buildMode("PROFILE_PANASONIC_GH6", "all-i-vlog", "ALL-I / V-Log", "V-Log", "V_LOG", [250, 2000], ["ALL-I"], { logName: "V-Log" }),
  ]),
  buildProfile("PROFILE_NIKON_Z6III", "Nikon", "Z6III", "N-Log mirrorless body with limited highlight headroom versus cinema RAW.", [
    buildMode("PROFILE_NIKON_Z6III", "nlog-h265", "N-Log H.265 10-bit", "N-Log", "N_LOG", [800], ["H.265 10-bit"], { logName: "N-Log", notes: "Treat as a protected LOG capture and monitor false color carefully." }),
    buildMode("PROFILE_NIKON_Z6III", "nraw", "N-RAW", "N-RAW", "N_LOG", [800], ["N-RAW"], { logName: "N-Log", rawName: "N-RAW", notes: "Use N-Log monitoring discipline when treating N-RAW as the negative." }),
    buildMode("PROFILE_NIKON_Z6III", "proresraw", "ProRes RAW HQ", "ProRes RAW HQ", null, [800], ["ProRes RAW HQ"], { rawName: "ProRes RAW HQ", notes: "Recorder-dependent. Confirm recorder path before relying on this mode." }),
  ]),
  buildProfile("PROFILE_NIKON_Z9", "Nikon", "Z9", "Nikon flagship with N-Log and RAW options.", [
    buildMode("PROFILE_NIKON_Z9", "nlog-h265", "N-Log H.265 10-bit", "N-Log", "N_LOG", [800], ["H.265 10-bit"], { logName: "N-Log", notes: "Treat as protected LOG capture and keep highlight discipline." }),
    buildMode("PROFILE_NIKON_Z9", "nraw-nlog", "N-RAW / N-Log", "N-RAW N-Log", "N_LOG", [800], ["N-RAW"], { logName: "N-Log", rawName: "N-RAW" }),
    buildMode("PROFILE_NIKON_Z9", "proresraw", "ProRes RAW HQ", "ProRes RAW HQ", null, [800], ["ProRes RAW HQ"], { rawName: "ProRes RAW HQ", notes: "Recorder-dependent. Confirm recorder path before relying on this mode." }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_BMPC_4K", "Blackmagic", "Production Camera 4K", "Blackmagic Production Camera 4K with legacy Film profile behavior.", [
    buildMode("PROFILE_BLACKMAGIC_BMPC_4K", "prores-film", "ProRes 422 HQ / Film", "BMD Film", null, [400], ["ProRes 422 HQ"], { logName: "BMD Film", notes: "Legacy film profile. If monitoring targets are missing, treat as Needs profile data." }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_4K", "Blackmagic", "Pocket Cinema Camera 4K", "BMCC 4K with Blackmagic RAW and ProRes options.", [
    buildMode("PROFILE_BLACKMAGIC_4K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["Q0", "Q5", "8:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
    buildMode("PROFILE_BLACKMAGIC_4K", "prores", "ProRes 422 HQ", "BMD Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["ProRes 422 HQ"], { logName: "BMD Film Gen 5" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_6K", "Blackmagic", "Pocket Cinema Camera 6K", "Blackmagic 6K body with Gen 5 monitoring.", [
    buildMode("PROFILE_BLACKMAGIC_6K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["Q0", "Q5", "8:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_6K_PRO", "Blackmagic", "Pocket Cinema Camera 6K Pro", "6K Pro with built-in ND and Gen 5 pipeline.", [
    buildMode("PROFILE_BLACKMAGIC_6K_PRO", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["Q0", "Q5", "8:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_6K_G2", "Blackmagic", "Pocket Cinema Camera 6K G2", "6K G2 with Blackmagic RAW baseline.", [
    buildMode("PROFILE_BLACKMAGIC_6K_G2", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["Q0", "Q5", "8:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_PYXIS_6K", "Blackmagic", "PYXIS 6K", "Blackmagic Gen 5 color science with strong BRAW flexibility.", [
    buildMode("PROFILE_BLACKMAGIC_PYXIS_6K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 1250], ["Q0", "Q5", "3:1", "5:1", "8:1", "12:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW", notes: "Use Gen 5 monitoring pipeline and keep texture controls neutral." }),
    buildMode("PROFILE_BLACKMAGIC_PYXIS_6K", "prores", "ProRes 422 HQ", "BMD Film Gen 5", "BMD_FILM_GEN5", [400, 1250], ["422 HQ"], { logName: "BMD Film Gen 5" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_12K", "Blackmagic", "URSA Mini Pro 12K", "High-resolution BRAW body with dual-base ISO behavior.", [
    buildMode("PROFILE_BLACKMAGIC_12K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["3:1", "5:1", "8:1", "12:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
  ]),
  buildProfile("PROFILE_RED_KOMODO", "RED", "KOMODO", "Compact global-shutter RED body; protect highlights before chasing shadow density.", [
    buildMode("PROFILE_RED_KOMODO", "redcode", "REDCODE RAW", "RED IPP2", "RED_IPP2", [800], ["HQ", "MQ", "LQ"], { logName: "RED Log3G10", rawName: "REDCODE RAW" }),
  ]),
  buildProfile("PROFILE_RED_V_RAPTOR", "RED", "V-RAPTOR", "High-end RED body with strong highlight discipline near native ISO.", [
    buildMode("PROFILE_RED_V_RAPTOR", "redcode", "REDCODE RAW", "RED IPP2", "RED_IPP2", [800, 3200], ["HQ", "MQ", "LQ"], { logName: "RED Log3G10", rawName: "REDCODE RAW" }),
  ]),

  // ── ARRI ──────────────────────────────────────────────────────────────────
  buildProfile("PROFILE_ARRI_ALEXA_35_ES", "ARRI", "Alexa 35 (Enhanced Sensitivity)", "Alexa 35 second base for low light. LogC4 discipline still applies.", [
    buildMode("PROFILE_ARRI_ALEXA_35_ES", "arriraw-logc4-es", "ARRIRAW / LogC4 (ES 2560)", "ARRIRAW LogC4 ES", "LOG_C", [2560], ["ARRIRAW"], { logName: "LogC4", rawName: "ARRIRAW", notes: "Enhanced Sensitivity base ISO 2560. Same LogC4 monitoring transform." }),
    buildMode("PROFILE_ARRI_ALEXA_35_ES", "prores-logc4-es", "ProRes 4444 XQ / LogC4 (ES 2560)", "LogC4 ES", "LOG_C", [2560], ["ProRes 4444 XQ"], { logName: "LogC4" }),
  ]),
  buildProfile("PROFILE_ARRI_ALEXA_MINI", "ARRI", "Alexa Mini (S35)", "Super 35 ARRI classic. LogC3 baseline, native EI 800.", [
    buildMode("PROFILE_ARRI_ALEXA_MINI", "arriraw-logc3", "ARRIRAW / LogC3", "ARRIRAW LogC3", "LOG_C", [800], ["ARRIRAW"], { logName: "LogC3", rawName: "ARRIRAW" }),
    buildMode("PROFILE_ARRI_ALEXA_MINI", "prores-logc3", "ProRes 4444 / LogC3", "LogC3", "LOG_C", [800], ["ProRes 4444", "ProRes 4444 XQ"], { logName: "LogC3" }),
  ]),
  buildProfile("PROFILE_ARRI_AMIRA", "ARRI", "AMIRA", "Documentary-style ARRI S35. LogC3, EI 800.", [
    buildMode("PROFILE_ARRI_AMIRA", "prores-logc3", "ProRes 4444 / LogC3", "LogC3", "LOG_C", [800], ["ProRes 4444", "ProRes 422 HQ"], { logName: "LogC3" }),
  ]),
  buildProfile("PROFILE_ARRI_ALEXA_265", "ARRI", "Alexa 265", "65 mm ARRI body. LogC4 / Wide Gamut 4, native EI 800.", [
    buildMode("PROFILE_ARRI_ALEXA_265", "arriraw-logc4", "ARRIRAW / LogC4", "ARRIRAW LogC4", "LOG_C", [800], ["ARRIRAW"], { logName: "LogC4", rawName: "ARRIRAW", notes: "65 mm sensor. Use a technical LogC4 transform before creative taste." }),
  ]),

  // ── Sony ──────────────────────────────────────────────────────────────────
  buildProfile("PROFILE_SONY_VENICE_2", "Sony", "Venice 2", "Sony Venice 2. X-OCN / S-Log3 with dual base ISO 800 / 3200.", [
    buildMode("PROFILE_SONY_VENICE_2", "xocn-slog3", "X-OCN / S-Log3", "X-OCN S-Log3", "S_LOG3", [800, 3200], ["X-OCN XT", "X-OCN ST", "X-OCN LT"], { logName: "S-Log3", rawName: "X-OCN", notes: "Dual base ISO 800 / 3200 (both 8.6K and 6K sensor modes)." }),
  ]),
  buildProfile("PROFILE_SONY_BURANO", "Sony", "BURANO", "Compact 8.6K Sony cine body. X-OCN / S-Log3, dual base ISO 800 / 3200.", [
    buildMode("PROFILE_SONY_BURANO", "xocn-slog3", "X-OCN LT / S-Log3", "X-OCN S-Log3", "S_LOG3", [800, 3200], ["X-OCN LT"], { logName: "S-Log3", rawName: "X-OCN" }),
    buildMode("PROFILE_SONY_BURANO", "xavc-slog3", "XAVC-I / S-Log3", "S-Log3", "S_LOG3", [800, 3200], ["XAVC-I", "XAVC HS"], { logName: "S-Log3" }),
  ]),
  buildProfile("PROFILE_SONY_FX2", "Sony", "FX2", "Full-frame hybrid Cinema Line body. S-Log3 dual base ISO 800 / 4000.", [
    buildMode("PROFILE_SONY_FX2", "xavc-slog3", "XAVC-I / S-Log3", "S-Log3", "S_LOG3", [800, 4000], ["XAVC-I", "XAVC HS", "XAVC-S"], { logName: "S-Log3", notes: "Cine EI / Cine EI Quick / Flexible ISO. 15+ stop dynamic range." }),
  ]),
  buildProfile("PROFILE_SONY_FX30", "Sony", "FX30", "Super 35 / APS-C Cinema Line body. S-Log3 dual base ISO 800 / 2500.", [
    buildMode("PROFILE_SONY_FX30", "xavc-slog3", "XAVC-I / S-Log3", "S-Log3", "S_LOG3", [800, 2500], ["XAVC-I", "XAVC HS", "XAVC-S"], { logName: "S-Log3", notes: "APS-C sensor. S-Gamut3.Cine still applies for matching." }),
  ]),

  // ── Canon ─────────────────────────────────────────────────────────────────
  buildProfile("PROFILE_CANON_C400", "Canon", "EOS C400", "6K full-frame Canon cine body. Triple base ISO 800 / 3200 / 12800.", [
    buildMode("PROFILE_CANON_C400", "cinemaraw-clog2", "Cinema RAW Light / C-Log2", "RAW C-Log2", "C_LOG2", [800, 3200, 12800], ["Cinema RAW Light"], { logName: "C-Log2", rawName: "Cinema RAW Light", notes: "Triple base ISO. Pick the base nearest your key and hold it." }),
    buildMode("PROFILE_CANON_C400", "xfavc-clog2", "XF-AVC / C-Log2", "C-Log2", "C_LOG2", [800, 3200, 12800], ["XF-AVC", "XF-AVC S"], { logName: "C-Log2" }),
  ]),
  buildProfile("PROFILE_CANON_C80", "Canon", "EOS C80", "Compact 6K full-frame Canon cine body. Triple base ISO 800 / 6400 / 12800.", [
    buildMode("PROFILE_CANON_C80", "cinemaraw-clog2", "Cinema RAW Light HQ / C-Log2", "RAW C-Log2", "C_LOG2", [800, 6400, 12800], ["Cinema RAW Light HQ", "Cinema RAW Light ST", "Cinema RAW Light LT"], { logName: "C-Log2", rawName: "Cinema RAW Light", notes: "Triple base ISO 800 / 6400 / 12800." }),
    buildMode("PROFILE_CANON_C80", "xfavc-clog2", "XF-AVC S / C-Log2", "C-Log2", "C_LOG2", [800, 6400, 12800], ["XF-AVC S", "XF-HEVC S"], { logName: "C-Log2" }),
  ]),

  // ── Panasonic ─────────────────────────────────────────────────────────────
  buildProfile("PROFILE_PANASONIC_S1H_II", "Panasonic", "S1 II / S1H II", "New-sensor L-mount V-Log body. Dual base ISO 640 / 4000.", [
    buildMode("PROFILE_PANASONIC_S1H_II", "all-i-vlog", "ALL-I / V-Log", "V-Log", "V_LOG", [640, 4000], ["ALL-I", "LongGOP", "ProRes"], { logName: "V-Log" }),
  ]),
  buildProfile("PROFILE_PANASONIC_S5IIX", "Panasonic", "S5 IIX", "Compact L-mount V-Log body. Dual base ISO 640 / 4000.", [
    buildMode("PROFILE_PANASONIC_S5IIX", "all-i-vlog", "ALL-I / V-Log", "V-Log", "V_LOG", [640, 4000], ["ALL-I", "LongGOP", "ProRes (ext.)"], { logName: "V-Log" }),
  ]),
  buildProfile("PROFILE_PANASONIC_GH7", "Panasonic", "GH7", "Micro four-thirds V-Log body. Dual base ISO 100 / 2000.", [
    buildMode("PROFILE_PANASONIC_GH7", "all-i-vlog", "ALL-I / V-Log", "V-Log", "V_LOG", [100, 2000], ["ALL-I", "LongGOP", "ProRes RAW (ext.)"], { logName: "V-Log", notes: "Small MFT highlight headroom. Protect speculars aggressively." }),
  ]),

  // ── Nikon ─────────────────────────────────────────────────────────────────
  buildProfile("PROFILE_NIKON_Z8", "Nikon", "Z8", "Nikon flagship-sensor body. N-Log / N-RAW, base ISO 800.", [
    buildMode("PROFILE_NIKON_Z8", "nlog-h265", "N-Log H.265 10-bit", "N-Log", "N_LOG", [800], ["H.265 10-bit"], { logName: "N-Log", notes: "Treat as a protected LOG capture and watch false color." }),
    buildMode("PROFILE_NIKON_Z8", "nraw-nlog", "N-RAW / N-Log", "N-RAW N-Log", "N_LOG", [800], ["N-RAW"], { logName: "N-Log", rawName: "N-RAW" }),
  ]),
  buildProfile("PROFILE_NIKON_ZR", "Nikon", "ZR (Nikon RED)", "First Nikon Z Cinema body, co-developed with RED. Dual base ISO 800 / 6400.", [
    buildMode("PROFILE_NIKON_ZR", "r3dne-log3g10", "REDCODE RAW (R3D NE) / Log3G10", "RED IPP2", "RED_IPP2", [800, 6400], ["R3D NE 12-bit"], { logName: "RED Log3G10", rawName: "REDCODE RAW (R3D NE)", notes: "R3D NE unlocks RED's REDWideGamutRGB / Log3G10. Match against RED IPP2 sources, not N-Log." }),
    buildMode("PROFILE_NIKON_ZR", "nraw-nlog", "N-RAW / N-Log", "N-RAW N-Log", "N_LOG", [800, 6400], ["N-RAW"], { logName: "N-Log", rawName: "N-RAW", notes: "Alternate pipeline. Use N-Log monitoring discipline." }),
    buildMode("PROFILE_NIKON_ZR", "proresraw", "ProRes RAW HQ", "ProRes RAW HQ", null, [800, 6400], ["ProRes RAW HQ", "ProRes 422 HQ"], { rawName: "ProRes RAW HQ" }),
  ]),

  // ── RED ───────────────────────────────────────────────────────────────────
  buildProfile("PROFILE_RED_KOMODO_X", "RED", "KOMODO-X", "Faster KOMODO with expanded frame rates. REDCODE / Log3G10, base ISO 800.", [
    buildMode("PROFILE_RED_KOMODO_X", "redcode", "REDCODE RAW", "RED IPP2", "RED_IPP2", [800], ["HQ", "MQ", "LQ"], { logName: "RED Log3G10", rawName: "REDCODE RAW" }),
  ]),
  buildProfile("PROFILE_RED_V_RAPTOR_XL", "RED", "V-RAPTOR [X] / XL", "V-RAPTOR X and XL. REDCODE / Log3G10, dual base ISO 800 / 3200.", [
    buildMode("PROFILE_RED_V_RAPTOR_XL", "redcode", "REDCODE RAW", "RED IPP2", "RED_IPP2", [800, 3200], ["HQ", "MQ", "LQ"], { logName: "RED Log3G10", rawName: "REDCODE RAW", notes: "Global-shutter X sensor. Second base ISO 3200." }),
  ]),

  // ── Blackmagic ────────────────────────────────────────────────────────────
  buildProfile("PROFILE_BLACKMAGIC_URSA_CINE_12K", "Blackmagic", "URSA Cine 12K LF", "Full-frame BRAW Gen 5 body. Dual base ISO 800 / 3200.", [
    buildMode("PROFILE_BLACKMAGIC_URSA_CINE_12K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [800, 3200], ["Q0", "Q1", "Q3", "Q5", "3:1", "5:1", "8:1", "12:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_PYXIS_12K", "Blackmagic", "PYXIS 12K LF", "Full-frame box body, Gen 5 color. Dual base ISO 800 / 3200.", [
    buildMode("PROFILE_BLACKMAGIC_PYXIS_12K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [800, 3200], ["Q0", "Q1", "Q3", "Q5", "3:1", "5:1", "8:1", "12:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
  ]),
  buildProfile("PROFILE_BLACKMAGIC_CINEMA_6K", "Blackmagic", "Cinema Camera 6K", "Full-frame L-mount, Gen 5 color. Dual base ISO 400 / 3200.", [
    buildMode("PROFILE_BLACKMAGIC_CINEMA_6K", "braw", "BRAW", "BRAW Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["Q0", "Q5", "3:1", "5:1", "8:1", "12:1"], { logName: "BMD Film Gen 5", rawName: "Blackmagic RAW" }),
    buildMode("PROFILE_BLACKMAGIC_CINEMA_6K", "prores", "ProRes 422 HQ", "BMD Film Gen 5", "BMD_FILM_GEN5", [400, 3200], ["ProRes 422 HQ"], { logName: "BMD Film Gen 5" }),
  ]),

  // ── Fujifilm ──────────────────────────────────────────────────────────────
  buildProfile("PROFILE_FUJI_XH2S", "Fujifilm", "X-H2S", "Stacked APS-C body. F-Log2 / F-Gamut, base ISO 1250.", [
    buildMode("PROFILE_FUJI_XH2S", "flog2-h265", "F-Log2 H.265 10-bit", "F-Log2", "F_LOG2", [1250], ["H.265 10-bit", "ProRes (ext.)"], { logName: "F-Log2", notes: "F-Log2 base ISO 1250. Hold greens clean in mixed light." }),
  ]),
  buildProfile("PROFILE_FUJI_GFX100_II", "Fujifilm", "GFX100 II", "Large-format Fujifilm body. F-Log2 / F-Gamut.", [
    buildMode("PROFILE_FUJI_GFX100_II", "flog2-h265", "F-Log2 H.265 10-bit", "F-Log2", "F_LOG2", [1000], ["H.265 10-bit", "ProRes RAW (ext.)"], { logName: "F-Log2", notes: "44x33 sensor. Treat F-Log2 as the protected negative." }),
  ]),
  buildProfile("PROFILE_FUJI_ETERNA", "Fujifilm", "GFX Eterna", "Fujifilm large-format cinema body. F-Log2 / F-Gamut.", [
    buildMode("PROFILE_FUJI_ETERNA", "flog2", "F-Log2", "F-Log2", "F_LOG2", [1000, 3200], ["ProRes 4444", "ProRes 422 HQ", "H.265 10-bit"], { logName: "F-Log2", notes: "Dedicated cinema body. Dual base behaviour; confirm on-set menu." }),
  ]),
];

export function listCameraBrands(): CameraBrand[] {
  return [...new Set(CAMERA_PROFILES.map((profile) => profile.brand))];
}

export function listModelsByBrand(brand: string): string[] {
  return CAMERA_PROFILES.filter((profile) => profile.brand === brand).map((profile) => profile.model);
}

export function listModes(brand: string, model: string): ModeProfile[] {
  return CAMERA_PROFILES.find((profile) => profile.brand === brand && profile.model === model)?.modes ?? [];
}

export function findCameraProfile(brand: string, model: string): CameraProfile | undefined {
  return CAMERA_PROFILES.find((profile) => profile.brand === brand && profile.model === model);
}
