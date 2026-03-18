import { CameraModel, LensData } from "./StarterSetupTypes";

export const CAMERA_MODELS: CameraModel[] = [
  // --- Nikon ---
  { brand: "Nikon", family: "Z Series", model: "Z9", type: "hybrid", dualNative: true, baseIso: [64, 400], isHybrid: true },
  { brand: "Nikon", family: "Z Series", model: "Z8", type: "hybrid", dualNative: true, baseIso: [64, 400], isHybrid: true },
  { brand: "Nikon", family: "Z Series", model: "Z6 III", type: "hybrid", dualNative: true, baseIso: [800, 6400], isHybrid: true },
  { brand: "Nikon", family: "Z Series", model: "Zf", type: "hybrid", dualNative: true, baseIso: [800, 6400], isHybrid: true },
  
  // --- Canon ---
  { brand: "Canon", family: "EOS R", model: "R3", type: "hybrid", dualNative: true, baseIso: [100, 800], isHybrid: true },
  { brand: "Canon", family: "EOS R", model: "R5", type: "hybrid", baseIso: [400], isHybrid: true },
  { brand: "Canon", family: "EOS R", model: "R6 II", type: "hybrid", baseIso: [800], isHybrid: true },
  { brand: "Canon", family: "EOS C", model: "C70", type: "cinema", dualNative: true, baseIso: [800, 3200], isHybrid: false },
  
  // --- Sony ---
  { brand: "Sony", family: "Alpha", model: "A1", type: "hybrid", dualNative: true, baseIso: [800, 3200], isHybrid: true },
  { brand: "Sony", family: "Alpha", model: "A7S III", type: "hybrid", dualNative: true, baseIso: [160, 12800], isHybrid: true }, // in S-Log3
  { brand: "Sony", family: "Alpha", model: "A7R V", type: "hybrid", baseIso: [100], isHybrid: true },
  { brand: "Sony", family: "FX", model: "FX3", type: "cinema", dualNative: true, baseIso: [800, 12800], isHybrid: false },
  { brand: "Sony", family: "FX", model: "FX6", type: "cinema", dualNative: true, baseIso: [800, 12800], isHybrid: false },
  
  // --- Fujifilm ---
  { brand: "Fujifilm", family: "X Series", model: "X-H2S", type: "hybrid", dualNative: true, baseIso: [1250], isHybrid: true },
  { brand: "Fujifilm", family: "X Series", model: "X-T5", type: "hybrid", baseIso: [125], isHybrid: true },
  { brand: "Fujifilm", family: "GFX", model: "GFX100 II", type: "hybrid", baseIso: [100], isHybrid: true },
  
  // --- Panasonic ---
  { brand: "Panasonic", family: "Lumix S", model: "S5 II", type: "hybrid", dualNative: true, baseIso: [640, 4000], isHybrid: true },
  { brand: "Panasonic", family: "Lumix S", model: "S1H", type: "hybrid", dualNative: true, baseIso: [640, 4000], isHybrid: true },
  { brand: "Panasonic", family: "Lumix GH", model: "GH6/GH7", type: "hybrid", dualNative: true, baseIso: [800, 2000], isHybrid: true },
  
  // --- Blackmagic ---
  { brand: "Blackmagic", family: "Pocket", model: "P6K / G2 / Pro", type: "cinema", dualNative: true, baseIso: [400, 3200], isHybrid: false },
  { brand: "Blackmagic", family: "Ursa", model: "Mini Pro 12K", type: "cinema", dualNative: true, baseIso: [800, 3200], isHybrid: false },
  { brand: "Blackmagic", family: "Pyxis", model: "6K", type: "cinema", dualNative: true, baseIso: [400, 3200], isHybrid: false },

  // --- RED ---
  { brand: "RED", family: "Komodo", model: "Komodo-X", type: "cinema", dualNative: false, baseIso: [800], isHybrid: false },
  { brand: "RED", family: "V-Raptor", model: "V-Raptor VV / S35", type: "cinema", dualNative: false, baseIso: [800], isHybrid: false },
];

export const LENS_MODELS: LensData[] = [
  { name: "24-70mm f/2.8", focalLength: 35, maxAperture: 2.8, type: "standard" },
  { name: "70-200mm f/2.8", focalLength: 100, maxAperture: 2.8, type: "tele" },
  { name: "35mm f/1.4 Prime", focalLength: 35, maxAperture: 1.4, type: "standard" },
  { name: "50mm f/1.2 Prime", focalLength: 50, maxAperture: 1.2, type: "standard" },
  { name: "85mm f/1.4 Prime", focalLength: 85, maxAperture: 1.4, type: "tele" },
  { name: "16-35mm f/2.8", focalLength: 16, maxAperture: 2.8, type: "wide" },
  { name: "100mm f/2.8 Macro", focalLength: 100, maxAperture: 2.8, type: "macro" },
];
