/**
 * Pack LDraw part geometry for the frontend (Sprint 1C).
 *
 * For every part in the generated catalog, resolves the full .dat dependency
 * tree from the extracted official LDraw library and inlines it into ONE
 * self-contained multi-part document at frontend/public/parts/<id>.dat —
 * exactly what three.js's packLDrawModel.mjs does, minimised for our use.
 * Also copies LDConfig.ldr next to them for LDrawLoader.preloadMaterials().
 *
 * Run:  node scripts/build_parts.mjs
 * Needs: .cache/ldraw/extracted/ldraw/{parts,p}  (from complete.zip)
 *        backend/app/catalog/catalog.json        (from build_catalog.py)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(ROOT, ".cache", "ldraw", "extracted", "ldraw");
const OUT = path.join(ROOT, "frontend", "public", "parts");
const CATALOG = path.join(ROOT, "backend", "app", "catalog", "catalog.json");

// LDrawLoader's own lookup order (subfolder prefixes tried per reference)
const SEARCH_DIRS = ["parts", "p", path.join("p", "48"), "models", ""];

function findFile(ref) {
  // references use backslashes (e.g. "s\3001s01.dat") and are case-insensitive
  const rel = ref.replace(/\\/g, path.sep).toLowerCase();
  for (const dir of SEARCH_DIRS) {
    const candidate = path.join(LIB, dir, rel);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// LDrawLoader's cache key for a reference: backslashes -> slashes, lowercase,
// then its standard-subfolder rewrite (`s/x` -> `parts/s/x`, `48/x` -> `p/48/x`,
// see LDrawLoader.js processObject). FILE names + rewritten refs both use this
// so every lookup is a cache hit and the loader never touches the network.
const normKey = (ref) => {
  let k = ref.replace(/\\/g, "/").toLowerCase();
  if (k.startsWith("s/")) k = "parts/" + k;
  else if (k.startsWith("48/")) k = "p/" + k;
  return k;
};

function collectDeps(ref, seen, missing) {
  const key = normKey(ref);
  if (seen.has(key)) return;
  const file = findFile(ref);
  if (!file) {
    missing.add(ref);
    return;
  }
  const raw = fs.readFileSync(file, "utf-8");
  // Rewrite every type-1 sub-file reference to its normalised key so the
  // loader's cache lookups match our `0 FILE` names EXACTLY (the official
  // files mix `s\3001s01.dat`, `48\4-4cyli.dat`, casing variants...).
  const lines = raw.split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t.startsWith("1 ")) return line;
    const fields = t.split(/\s+/);
    if (fields.length < 15) return line;
    const subRef = fields.slice(14).join(" ");
    return [...fields.slice(0, 14), normKey(subRef)].join(" ");
  });
  seen.set(key, lines.join("\n"));
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("1 ")) continue;
    const fields = t.split(/\s+/);
    if (fields.length < 15) continue;
    collectDeps(fields.slice(14).join(" "), seen, missing);
  }
}

function packPart(id) {
  const rootRef = `${id}.dat`;
  const seen = new Map(); // insertion order: root first, deps after
  const missing = new Set();
  collectDeps(rootRef, seen, missing);
  if (!seen.size) return { ok: false, missing: [rootRef] };

  // MPD: root file first so the loader treats it as the main model
  const chunks = [];
  for (const [name, text] of seen) {
    chunks.push(`0 FILE ${name}`);
    chunks.push(text.trimEnd());
    chunks.push("0 NOFILE");
  }
  fs.writeFileSync(path.join(OUT, `${id}.dat`), chunks.join("\n") + "\n");
  return { ok: true, files: seen.size, missing: [...missing] };
}

// ---------------------------------------------------------------------------
if (!fs.existsSync(LIB)) {
  console.error(`LDraw library not found at ${LIB} — extract complete.zip first.`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf-8"));
let okCount = 0;
const problems = [];
for (const part of catalog.parts) {
  const r = packPart(part.id);
  if (r.ok) {
    okCount += 1;
    const size = fs.statSync(path.join(OUT, `${part.id}.dat`)).size;
    const warn = r.missing.length ? `  MISSING REFS: ${r.missing.join(", ")}` : "";
    console.log(
      `  ${part.id.padStart(6)}  ${String(r.files).padStart(3)} files  ` +
      `${(size / 1024).toFixed(1).padStart(7)} KB${warn}`
    );
    if (r.missing.length) problems.push(`${part.id}: missing ${r.missing.join(", ")}`);
  } else {
    problems.push(`${part.id}: NOT FOUND in library`);
    console.error(`  ${part.id.padStart(6)}  NOT FOUND`);
  }
}

fs.copyFileSync(path.join(LIB, "LDConfig.ldr"), path.join(OUT, "LDConfig.ldr"));
console.log(`\npacked ${okCount}/${catalog.parts.length} parts -> ${path.relative(ROOT, OUT)}`);
if (problems.length) {
  console.error(`PROBLEMS:\n  ${problems.join("\n  ")}`);
  process.exit(2);
}
