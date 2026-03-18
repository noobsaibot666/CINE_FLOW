import { 
  StarterSetupInputs, 
  SetupOutput, 
  SetupRow, 
} from "./StarterSetupTypes";

export class StarterSetupEngine {
  public static calculate(inputs: StarterSetupInputs): SetupOutput {
    if (inputs.captureType === "video") {
      return this.calculateVideo(inputs);
    }
    return this.calculatePhoto(inputs);
  }

  // =========================================================================
  // VIDEO WORKFLOW (Cinematography Mindset)
  // =========================================================================
  private static calculateVideo(inputs: StarterSetupInputs): SetupOutput {
    return {
      whiteBalance: this.getVideoWB(inputs),
      aperture: this.getVideoAperture(inputs),
      shutter: this.getVideoShutter(inputs),
      iso: this.getVideoIso(inputs),
      // Flash not applicable for video usually in this tool
      checkFirst: this.getVideoCheckFirst(),
      avoid: this.getVideoAvoid(),
    };
  }

  private static getVideoWB(inputs: StarterSetupInputs): SetupRow {
    const icon = "thermometer";
    let value = "";
    const action = "Set Kelvin, lock WB. Avoid AWB drift.";

    switch (inputs.lightCondition) {
      case "daylight": value = "5600K (Daylight)"; break;
      case "tungsten": value = "3200K (Tungsten)"; break;
      case "fluorescent": value = "4300K (Cool White)"; break;
      case "studio": value = "5600K (Calibrated)"; break;
      case "window_light": value = "5400K - 5600K"; break;
      case "mixed": value = "Custom Kelvin (Global Match)"; break;
      default: value = "5600K (Standard)"; break;
    }

    return { 
      label: "White Balance", 
      value, 
      action, 
      tooltip: "Controlled Kelvin is mandatory for video to prevent mid-shot color temperature shifts.",
      icon 
    };
  }

  private static getVideoAperture(inputs: StarterSetupInputs): SetupRow {
    const icon = "circle";
    const max = inputs.lens.maxAperture;
    let value = `f/${(max + 0.5).toFixed(1)}`;
    let action = "Hold depth of field for focus reliability.";
    let tooltip = "Exposure should be fine-tuned via Aperture or ND, not shutter.";

    if (inputs.priority === "shallow_depth") {
      value = `f/${max} (Wide Open)`;
      action = "Cinematic isolation. Pull focus carefully.";
    } else if (inputs.priority === "sharpness") {
      value = "f/4.0 - f/5.6";
      action = "Optimal optical performance.";
      tooltip = "Use the lens's 'sweet spot' for maximum sharpness across the frame.";
    }

    return {
      label: "Aperture",
      value,
      action,
      tooltip,
      icon
    };
  }

  private static getVideoShutter(inputs: StarterSetupInputs): SetupRow {
    const icon = "clock";
    let value = "180° Shutter Angle";
    let action = "Natural motion blur (standard).";
    let tooltip = "Maintain 180° for consistent motion rendering regardless of frame rate.";

    if (inputs.movementLevel === "fast" || inputs.priority === "freeze_motion") {
      value = "90° or 45° Shutter Angle";
      action = "Action style (reduce motion blur / crisp edges).";
      tooltip = "Narrower angles (higher speeds) create the 'staccato' look common in high-action sequences.";
    } else if (inputs.lightCondition === "low_light") {
      value = "270° Shutter Angle";
      action = "Gain light, but expect softer motion.";
      tooltip = "Opening the shutter beyond 180° adds exposure but creates persistent blur; use as a last resort.";
    }

    return { 
      label: "Shutter", 
      value, 
      action, 
      tooltip: "Do not expose with shutter. Keep motion blur consistent.", 
      icon 
    };
  }

  private static getVideoIso(inputs: StarterSetupInputs): SetupRow {
    const icon = "bar-chart";
    const baseIso = inputs.camera?.baseIso?.[0] || 800;
    const dualIso = inputs.camera?.baseIso?.[1];
    
    let value = `ISO ${baseIso} (Native Base)`;
    let action = "Prioritize dynamic range.";
    
    if (inputs.lightCondition === "low_light" && dualIso) {
      value = `ISO ${dualIso} (High Native)`;
      action = "Switch to high gain circuit for clean shadows.";
    }

    return { 
      label: "ISO", 
      value, 
      action, 
      tooltip: "Video sensors perform best at their native gain stages. Avoid unnecessary noise floor pushing.",
      icon 
    };
  }

  private static getVideoCheckFirst(): SetupRow {
    return {
      label: "Check first",
      value: "Highlight protection & Exposure Tools",
      action: "Reference Waveform or False Color.",
      tooltip: "Protect your highlights at all costs; video data is hardest to recover in the peaks.",
      icon: "clipboard-check"
    };
  }

  private static getVideoAvoid(): SetupRow {
    return {
      label: "Avoid",
      value: "Avoid exposure adjustments with shutter",
      action: "Keep the 180° look locked for the whole edit.",
      tooltip: "Varying shutter angles between shots will cause distracting changes in motion texture.",
      icon: "alert-triangle"
    };
  }

  // =========================================================================
  // PHOTO WORKFLOW (Photography Mindset)
  // =========================================================================
  private static calculatePhoto(inputs: StarterSetupInputs): SetupOutput {
    return {
      whiteBalance: this.getPhotoWB(inputs),
      aperture: this.getPhotoAperture(inputs),
      shutter: this.getPhotoShutter(inputs),
      iso: this.getPhotoIso(inputs),
      flash: inputs.flashEnabled ? this.getFlash() : undefined,
      checkFirst: this.getPhotoCheckFirst(),
      avoid: this.getPhotoAvoid(),
    };
  }

  private static getPhotoWB(inputs: StarterSetupInputs): SetupRow {
    const icon = "thermometer";
    let value = "Auto White Balance (AWB)";
    let action = "AWB OK, verify consistency in preview.";

    if (inputs.lightCondition === "mixed") {
      value = "Kelvin manually set";
      action = "Set Kelvin for mixed/complex lighting.";
    }

    return { 
      label: "White Balance", 
      value, 
      action, 
      tooltip: "Modern cameras handle AWB for stills effectively, but Kelvin is safer for batches.",
      icon 
    };
  }

  private static getPhotoAperture(inputs: StarterSetupInputs): SetupRow {
    const icon = "circle";
    const max = inputs.lens.maxAperture;
    let value = "f/4.0 - f/5.6";
    let action = "Standard practical depth.";

    if (inputs.priority === "shallow_depth") {
      value = `f/${max}`;
      action = "Maximize isolation for subject separation.";
    }

    return { label: "Aperture", value, action, tooltip: "Adjust aperture based on the 'look' and depth required.", icon };
  }

  private static getPhotoShutter(inputs: StarterSetupInputs): SetupRow {
    const icon = "clock";
    let value = "1/125 - 1/250";
    let action = "Stay above handheld-safe range.";

    if (inputs.priority === "freeze_motion" || inputs.movementLevel === "fast") {
      value = "1/1000 or Faster";
      action = "Freeze motion for crisp capture.";
    } else if (inputs.subject === "portrait") {
      value = "1/200 (Sync speed limited?)";
      action = "Balance with flash or ambient light.";
    }

    return { 
      label: "Shutter", 
      value, 
      action, 
      tooltip: "Free movement is allowed here to secure exposure without motion blur.", 
      icon 
    };
  }

  private static getPhotoIso(inputs: StarterSetupInputs): SetupRow {
    const icon = "bar-chart";
    const baseIso = inputs.camera?.baseIso?.[0] || 100;
    
    let value = `ISO ${baseIso} (Start)`;
    let action = "Raise ISO if needed to secure exposure.";
    
    if (inputs.lightCondition === "low_light") {
      value = "ISO 800 - 1600";
      action = "Moderate gain for visibility.";
    }

    return { 
      label: "ISO", 
      value, 
      action, 
      tooltip: "ISO is the final adjustment in the exposure triangle for stills.", 
      icon 
    };
  }

  private static getFlash(): SetupRow {
    return {
      label: "Flash",
      value: "Bounce or Diffused Flash",
      action: "Soften the source, add catchlights.",
      tooltip: "Flash adds dimension and fills shadows in high-contrast photo scenarios.",
      icon: "zap"
    };
  }

  private static getPhotoCheckFirst(): SetupRow {
    return {
      label: "Check first",
      value: "Blinkies (Overexposure indicators)",
      action: "Check histogram for clipped shadows or highlights.",
      tooltip: "Verify the dynamic range fits your capture before the moment passes.",
      icon: "clipboard-check"
    };
  }

  private static getPhotoAvoid(): SetupRow {
    return {
      label: "Avoid",
      value: "Avoid ISO-first exposure logic",
      action: "Maximize light via Aperture/Shutter before gain.",
      tooltip: "Maintain the highest signal-to-noise ratio by using mechanical light first.",
      icon: "alert-triangle"
    };
  }
}
