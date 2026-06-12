/**
 * Sync the prompt grammar to the frontend (same two-output philosophy as
 * build_catalog.py): backend/app/prompt_grammar.json is the source of truth,
 * frontend/src/lib/promptGrammar.gen.json is the generated copy the UI
 * imports. Asserts the structural invariants before writing.
 *
 * Run:  node scripts/sync_grammar.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "backend", "app", "prompt_grammar.json");
const DEST = path.join(ROOT, "frontend", "src", "lib", "promptGrammar.gen.json");

const grammar = JSON.parse(fs.readFileSync(SRC, "utf-8"));

// invariant 1: the enhancer reference is the join of the slot examples,
// and it must end with the studio tail
const reference = grammar.slots.map((s) => s.example).join(", ");
if (!reference.endsWith(grammar.style_suffix)) {
  throw new Error("grammar invariant broken: reference must end with style_suffix");
}
// invariant 2: the last slot IS the studio tail
const last = grammar.slots[grammar.slots.length - 1];
if (last.id !== "studio_tail" || last.example !== grammar.style_suffix) {
  throw new Error("grammar invariant broken: slots[last] must be studio_tail === style_suffix");
}
// invariant 3: every slot carries what the UI needs
for (const s of grammar.slots) {
  for (const k of ["id", "name", "example", "ui_hint", "tone"]) {
    if (!s[k]) throw new Error(`grammar invariant broken: slot ${s.id || "?"} missing ${k}`);
  }
}

fs.writeFileSync(DEST, JSON.stringify(grammar, null, 1) + "\n");
console.log(`grammar OK (${grammar.slots.length} slots) -> ${path.relative(ROOT, DEST)}`);
