export type CameraType = "photo" | "hybrid" | "cinema";

export interface CameraBrand {
  name: string;
  families: string[];
}

export interface CameraModel {
  brand: string;
  family: string;
  model: string;
  type: CameraType;
  baseIso?: number[];
  dualNative?: boolean;
  highlightSensitivity?: "high" | "normal" | "low"; // how much highlight room it has
  isHybrid?: boolean; 
  lutSupport?: boolean;
}

export type CaptureType = "photo" | "video";

export type SubjectType = 
  | "food"
  | "portrait"
  | "team"
  | "product"
  | "car"
  | "architecture"
  | "interior"
  | "event"
  | "documentary";

export type EnvironmentType = "interior" | "exterior";

export type LightCondition = 
  | "daylight"
  | "mixed"
  | "tungsten"
  | "fluorescent"
  | "low_light"
  | "studio"
  | "window_light";

export type MovementLevel = "static" | "light" | "fast";

export type PriorityType = 
  | "sharpness"
  | "low_noise"
  | "shallow_depth"
  | "freeze_motion"
  | "natural_skin"
  | "speed";

export interface LensData {
  name?: string;
  focalLength: number;
  maxAperture: number;
  type: "wide" | "standard" | "tele" | "macro";
}

export interface StarterSetupInputs {
  camera: CameraModel | null;
  lens: LensData;
  captureType: CaptureType;
  flashEnabled: boolean;
  subject: SubjectType;
  environment: EnvironmentType;
  lightCondition: LightCondition;
  movementLevel: MovementLevel;
  priority: PriorityType;
}

export interface SetupRow {
  label: string;
  value: string;
  action: string;
  tooltip: string;
  icon: string;
}

export interface SetupOutput {
  whiteBalance: SetupRow;
  aperture: SetupRow;
  shutter: SetupRow;
  iso: SetupRow;
  flash?: SetupRow;
  checkFirst: SetupRow;
  avoid: SetupRow;
}
