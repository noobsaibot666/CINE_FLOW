import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const defaultApp = "src-tauri/target/release/bundle/macos/CineFlow Suite.app";
const defaultDmg = "src-tauri/target/release/bundle/dmg/CineFlow Suite_1.0.5_aarch64.dmg";

const args = parseArgs(process.argv.slice(2));
const appPath = resolve(args.app ?? defaultApp);
const dmgPath = resolve(args.dmg ?? defaultDmg);
const strict = Boolean(args.strict);

const contents = join(appPath, "Contents");
const macos = join(contents, "MacOS");
const resources = join(contents, "Resources");

const requiredChecks = [
  fileCheck("macos-app", "macOS .app bundle", appPath),
  fileCheck("macos-binary", "CineFlow executable", join(macos, "cineflow-suite")),
  fileCheck("macos-dmg", "macOS DMG installer", dmgPath),
  fileCheck("ffmpeg", "FFmpeg sidecar", join(macos, "ffmpeg")),
  fileCheck("ffprobe", "FFprobe sidecar", join(macos, "ffprobe")),
  fileCheck("braw-bridge", "BRAW bridge sidecar", join(macos, "braw_bridge")),
  fileCheck("redline", "REDline sidecar", join(macos, "REDline")),
  fileCheck("resources", "Bundled resources directory", join(resources, "resources")),
  fileCheck("camera-profiles", "Camera profiles resource", join(resources, "resources", "camera_profiles.json")),
  fileCheck("look-presets", "Look presets resource", join(resources, "resources", "look_presets.json")),
];

const optionalChecks = [
  anyFileCheck("ocio-config", "OCIO/ACES config", [
    join(resources, "resources", "ocio", "config.ocio"),
    join(resources, "resources", "aces", "config.ocio"),
    join(resources, "resources", "config.ocio"),
  ]),
  fileCheck("ocio-processor", "OCIO processor", join(macos, "ocioconvert"), "blocked"),
  fileCheck("libraw-bridge", "LibRaw frame-decode bridge", join(macos, "libraw_bridge"), "blocked"),
];

const requiredFailed = requiredChecks.filter((check) => check.status !== "pass");
const optionalBlocked = optionalChecks.filter((check) => check.status !== "pass");
const exitCode = requiredFailed.length > 0 || (strict && optionalBlocked.length > 0) ? 1 : 0;

printSection("macOS V1.2 required runtime");
for (const check of requiredChecks) printCheck(check);

printSection("macOS V1.2 optional RAW/OCIO runtime gates");
for (const check of optionalChecks) printCheck(check);

console.log("");
if (requiredFailed.length > 0) {
  console.error(`macOS V1.2 runtime check failed: ${requiredFailed.length} required item(s) missing.`);
} else if (strict && optionalBlocked.length > 0) {
  console.error(`macOS V1.2 strict runtime check failed: ${optionalBlocked.length} RAW/OCIO gate(s) blocked.`);
} else if (optionalBlocked.length > 0) {
  console.log(`macOS V1.2 package runtime passed with ${optionalBlocked.length} blocked RAW/OCIO gate(s).`);
} else {
  console.log("macOS V1.2 package runtime passed with all RAW/OCIO gates available.");
}

process.exit(exitCode);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--strict") {
      parsed.strict = true;
    } else if (value === "--app") {
      parsed.app = values[index + 1];
      index += 1;
    } else if (value === "--dmg") {
      parsed.dmg = values[index + 1];
      index += 1;
    } else {
      console.error(`Unknown argument: ${value}`);
      process.exit(2);
    }
  }
  return parsed;
}

function fileCheck(id, label, path, missingStatus = "fail") {
  return {
    id,
    label,
    path,
    status: existsSync(path) ? "pass" : missingStatus,
    detail: existsSync(path) ? sizeDetail(path) : "missing",
  };
}

function anyFileCheck(id, label, paths) {
  const found = paths.find((path) => existsSync(path));
  return {
    id,
    label,
    path: found ?? paths.join(" | "),
    status: found ? "pass" : "blocked",
    detail: found ? sizeDetail(found) : "not bundled",
  };
}

function sizeDetail(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) return "directory";
  return `${Math.ceil(stat.size / 1024)} KB`;
}

function printSection(label) {
  console.log("");
  console.log(label);
}

function printCheck(check) {
  const marker = check.status === "pass" ? "PASS" : check.status.toUpperCase();
  console.log(`[${marker}] ${check.label}: ${check.detail}`);
  console.log(`       ${check.path}`);
}
