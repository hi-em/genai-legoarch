/**
 * Pack the 40 LoRA training photos for the launch intro montage (B5).
 *
 * comfyui/legoarch-dataset/legoarch-*.png (1024², ~600KB) →
 * frontend/src/intro-assets/legoarch-NN.webp (≤360px, q72, ~20KB) so the
 * lazy-loaded intro chunk ships ~1MB of imagery instead of ~24MB.
 *
 * Idempotent: outputs newer than their source are skipped. `--force`
 * re-encodes everything.
 *
 * Run:  node scripts/build_intro_assets.mjs [--force]
 * Needs: sharp (frontend devDependency — resolved via frontend/package.json)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "comfyui", "legoarch-dataset");
const OUT = path.join(ROOT, "frontend", "src", "intro-assets");
const FORCE = process.argv.includes("--force");

// sharp lives in the frontend's node_modules — resolve relative to its manifest.
const require = createRequire(path.join(ROOT, "frontend", "package.json"));
const sharp = require("sharp");

if (!fs.existsSync(SRC)) {
  console.error(`dataset not found at ${SRC}`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const sources = fs
  .readdirSync(SRC)
  .filter((f) => /^legoarch-\d+\.png$/i.test(f))
  .sort();

let encoded = 0;
let skipped = 0;
let totalBytes = 0;

for (const file of sources) {
  const inPath = path.join(SRC, file);
  const outPath = path.join(OUT, file.replace(/\.png$/i, ".webp"));

  const fresh =
    !FORCE &&
    fs.existsSync(outPath) &&
    fs.statSync(outPath).mtimeMs >= fs.statSync(inPath).mtimeMs;

  if (fresh) {
    skipped += 1;
  } else {
    await sharp(inPath)
      .resize(360, 360, { fit: "inside" })
      .webp({ quality: 72 })
      .toFile(outPath);
    encoded += 1;
  }

  const size = fs.statSync(outPath).size;
  totalBytes += size;
  console.log(
    `  ${file.padEnd(18)} -> ${path.basename(outPath).padEnd(19)} ` +
    `${(size / 1024).toFixed(1).padStart(6)} KB${fresh ? "  (fresh, skipped)" : ""}`
  );
}

console.log(
  `\n${sources.length} tiles -> ${path.relative(ROOT, OUT)} ` +
  `(${encoded} encoded, ${skipped} skipped, ${(totalBytes / 1024).toFixed(0)} KB total)`
);
