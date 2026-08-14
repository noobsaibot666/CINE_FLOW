import { chmodSync, copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printUsage();
  process.exit(0);
}

const staged = [];

if (!args.ocioConfig && !args.ocioProcessor && !args.librawBridge) {
  console.error("No assets provided. Pass at least one of --ocio-config, --ocio-processor, or --libraw-bridge.");
  printUsage();
  process.exit(2);
}

if (args.ocioConfig) {
  stageFile({
    label: "OCIO/ACES config",
    source: args.ocioConfig,
    destination: join("src-tauri", "resources", "ocio", "config.ocio"),
    executable: false,
    validate: (path) => basename(path) === "config.ocio",
    validationMessage: "OCIO config source must be named config.ocio.",
  });
}

if (args.ocioProcessor) {
  stageFile({
    label: "OCIO processor",
    source: args.ocioProcessor,
    destination: join("src-tauri", "resources", "bin", "ocioconvert"),
    executable: true,
  });
}

if (args.librawBridge) {
  stageFile({
    label: "LibRaw frame-decode bridge",
    source: args.librawBridge,
    destination: join("src-tauri", "resources", "bin", "libraw_bridge"),
    executable: true,
  });
}

console.log("");
console.log("macOS V1.2 asset staging complete.");
for (const item of staged) {
  console.log(`[STAGED] ${item.label}: ${item.destination}`);
}
console.log("");
console.log("Next steps:");
console.log("- Run `npm run build:direct` with host hdiutil access.");
console.log("- Run `npm run verify:macos:v12 -- --strict` after the package is rebuilt.");

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") {
      parsed.help = true;
    } else if (value === "--ocio-config") {
      requireValue(values, index, value);
      parsed.ocioConfig = values[index + 1];
      index += 1;
    } else if (value === "--ocio-processor") {
      requireValue(values, index, value);
      parsed.ocioProcessor = values[index + 1];
      index += 1;
    } else if (value === "--libraw-bridge") {
      requireValue(values, index, value);
      parsed.librawBridge = values[index + 1];
      index += 1;
    } else {
      console.error(`Unknown argument: ${value}`);
      printUsage();
      process.exit(2);
    }
  }
  return parsed;
}

function stageFile({ label, source, destination, executable, validate, validationMessage }) {
  const sourcePath = resolve(source);
  const destinationPath = resolve(destination);

  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    console.error(`${label} source is missing or not a file: ${sourcePath}`);
    process.exit(1);
  }

  if (validate && !validate(sourcePath)) {
    console.error(validationMessage);
    process.exit(1);
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);

  if (executable) {
    chmodSync(destinationPath, 0o755);
  }

  staged.push({ label, destination: destinationPath });
}

function requireValue(values, index, option) {
  const next = values[index + 1];
  if (!next || next.startsWith("--")) {
    console.error(`${option} requires a file path.`);
    printUsage();
    process.exit(2);
  }
}

function printUsage() {
  console.log(`
Usage:
  node scripts/production/stage_macos_v12_assets.mjs [options]

Options:
  --ocio-config <path>      Copy an OCIO/ACES config named config.ocio.
  --ocio-processor <path>   Copy an ocioconvert-compatible executable.
  --libraw-bridge <path>    Copy a LibRaw frame-decode bridge executable.

Staging destinations:
  src-tauri/resources/ocio/config.ocio
  src-tauri/resources/bin/ocioconvert
  src-tauri/resources/bin/libraw_bridge
`);
}
