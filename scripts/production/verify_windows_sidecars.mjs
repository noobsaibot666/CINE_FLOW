import { existsSync } from "node:fs";
import { join } from "node:path";

const required = [
  "ffmpeg-x86_64-pc-windows-msvc.exe",
  "ffprobe-x86_64-pc-windows-msvc.exe",
  "braw_bridge-x86_64-pc-windows-msvc.exe",
  "REDline-x86_64-pc-windows-msvc.exe",
  "BlackmagicRawAPI.dll",
];

const binDir = join(process.cwd(), "src-tauri", "bin");
const missing = required.filter((file) => !existsSync(join(binDir, file)));

if (missing.length > 0) {
  console.error("Windows sidecar check failed. Missing files in src-tauri/bin:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  console.error("");
  console.error("Copy these files from the Windows staging folder before building:");
  console.error('Copy-Item "WIN\\*" "src-tauri\\bin\\" -Force');
  process.exit(1);
}

console.log("Windows sidecar check passed.");
