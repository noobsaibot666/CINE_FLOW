export type ProductionSourceProfileId =
  | "SONY_SLOG3_SGAMUT3_CINE"
  | "CANON_CLOG2_CINEMA_GAMUT"
  | "CANON_CLOG3_CINEMA_GAMUT"
  | "ARRI_LOGC3_WIDE_GAMUT"
  | "ARRI_LOGC4_WIDE_GAMUT4"
  | "RED_LOG3G10_RED_WIDE_GAMUT"
  | "BMD_FILM_GEN5_WIDE_GAMUT"
  | "PANASONIC_VLOG_VGAMUT"
  | "FUJI_FLOG2_FGAMUT"
  | "NIKON_NLOG"
  | "REC709";

export interface ProductionSourceProfile {
  id: ProductionSourceProfileId;
  label: string;
  transferCurve: string;
  colorGamut: string;
  acesFamily: "vendor_idt" | "ocio_builtin" | "display_referred";
  notes: string;
}

export const PRODUCTION_SOURCE_PROFILES: Record<ProductionSourceProfileId, ProductionSourceProfile> = {
  SONY_SLOG3_SGAMUT3_CINE: {
    id: "SONY_SLOG3_SGAMUT3_CINE",
    label: "Sony S-Log3 / S-Gamut3.Cine",
    transferCurve: "S-Log3",
    colorGamut: "S-Gamut3.Cine",
    acesFamily: "vendor_idt",
    notes: "Primary Sony cinema baseline for FX and Venice workflows.",
  },
  CANON_CLOG2_CINEMA_GAMUT: {
    id: "CANON_CLOG2_CINEMA_GAMUT",
    label: "Canon C-Log2 / Cinema Gamut",
    transferCurve: "C-Log2",
    colorGamut: "Cinema Gamut",
    acesFamily: "vendor_idt",
    notes: "Preferred Canon cinema negative profile when the camera mode supports C-Log2.",
  },
  CANON_CLOG3_CINEMA_GAMUT: {
    id: "CANON_CLOG3_CINEMA_GAMUT",
    label: "Canon C-Log3 / Cinema Gamut",
    transferCurve: "C-Log3",
    colorGamut: "Cinema Gamut",
    acesFamily: "vendor_idt",
    notes: "Canon log profile for compact cinema bodies and XF-AVC workflows.",
  },
  ARRI_LOGC3_WIDE_GAMUT: {
    id: "ARRI_LOGC3_WIDE_GAMUT",
    label: "ARRI LogC3 / Wide Gamut",
    transferCurve: "LogC3",
    colorGamut: "ARRI Wide Gamut",
    acesFamily: "vendor_idt",
    notes: "ARRI LogC profile used by Alexa Mini LF and classic Alexa pipelines.",
  },
  ARRI_LOGC4_WIDE_GAMUT4: {
    id: "ARRI_LOGC4_WIDE_GAMUT4",
    label: "ARRI LogC4 / Wide Gamut 4",
    transferCurve: "LogC4",
    colorGamut: "ARRI Wide Gamut 4",
    acesFamily: "vendor_idt",
    notes: "ARRI Alexa 35 baseline for ACES-aware production matching.",
  },
  RED_LOG3G10_RED_WIDE_GAMUT: {
    id: "RED_LOG3G10_RED_WIDE_GAMUT",
    label: "RED Log3G10 / REDWideGamutRGB",
    transferCurve: "Log3G10",
    colorGamut: "REDWideGamutRGB",
    acesFamily: "vendor_idt",
    notes: "RED IPP2 technical profile for REDCODE workflows.",
  },
  BMD_FILM_GEN5_WIDE_GAMUT: {
    id: "BMD_FILM_GEN5_WIDE_GAMUT",
    label: "Blackmagic Film Gen 5 / Wide Gamut Gen 5",
    transferCurve: "Blackmagic Film Gen 5",
    colorGamut: "Blackmagic Design Wide Gamut Gen 5",
    acesFamily: "vendor_idt",
    notes: "Blackmagic RAW and ProRes Gen 5 monitoring baseline.",
  },
  PANASONIC_VLOG_VGAMUT: {
    id: "PANASONIC_VLOG_VGAMUT",
    label: "Panasonic V-Log / V-Gamut",
    transferCurve: "V-Log",
    colorGamut: "V-Gamut",
    acesFamily: "vendor_idt",
    notes: "Panasonic V-Log source profile for S-series and GH cinema workflows.",
  },
  FUJI_FLOG2_FGAMUT: {
    id: "FUJI_FLOG2_FGAMUT",
    label: "Fujifilm F-Log2 / F-Gamut",
    transferCurve: "F-Log2",
    colorGamut: "F-Gamut",
    acesFamily: "vendor_idt",
    notes: "Reserved for Fujifilm F-Log2 camera additions.",
  },
  NIKON_NLOG: {
    id: "NIKON_NLOG",
    label: "Nikon N-Log",
    transferCurve: "N-Log",
    colorGamut: "Nikon N-Gamut",
    acesFamily: "vendor_idt",
    notes: "Nikon log profile for H.265 and N-RAW-guided analysis.",
  },
  REC709: {
    id: "REC709",
    label: "Rec.709",
    transferCurve: "Rec.709",
    colorGamut: "Rec.709",
    acesFamily: "display_referred",
    notes: "Display-referred fallback when no camera log profile is available.",
  },
};

export function getProductionSourceProfile(
  id: ProductionSourceProfileId | null | undefined,
): ProductionSourceProfile | null {
  if (!id) return null;
  return PRODUCTION_SOURCE_PROFILES[id] ?? null;
}

export function deriveSourceProfileId(
  signalProfile: string | null | undefined,
  logName?: string,
): ProductionSourceProfileId | null {
  if (signalProfile === "LOG_C") {
    return logName?.toLowerCase().includes("logc4")
      ? "ARRI_LOGC4_WIDE_GAMUT4"
      : "ARRI_LOGC3_WIDE_GAMUT";
  }
  if (signalProfile === "C_LOG2") {
    return logName?.toLowerCase().includes("c-log3")
      ? "CANON_CLOG3_CINEMA_GAMUT"
      : "CANON_CLOG2_CINEMA_GAMUT";
  }
  if (signalProfile === "S_LOG3") return "SONY_SLOG3_SGAMUT3_CINE";
  if (signalProfile === "RED_IPP2") return "RED_LOG3G10_RED_WIDE_GAMUT";
  if (signalProfile === "BMD_FILM_GEN5") return "BMD_FILM_GEN5_WIDE_GAMUT";
  if (signalProfile === "V_LOG") return "PANASONIC_VLOG_VGAMUT";
  if (signalProfile === "F_LOG2") return "FUJI_FLOG2_FGAMUT";
  if (signalProfile === "N_LOG") return "NIKON_NLOG";
  if (signalProfile === "REC709") return "REC709";
  return null;
}
