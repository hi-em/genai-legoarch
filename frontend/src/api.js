// API layer. MOCK=true runs everything in-browser (no ComfyUI needed) so the
// whole UI is clickable today. Flip MOCK=false (and implement the fetch calls)
// once the FastAPI backend + ComfyUI are wired.
import { generateBuilding } from "./lib/voxel.js";
import { legolize } from "./lib/legolize.js";

export const MOCK = true;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const seedOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// Step 1: prompt/photo -> LEGO render. (AI image is MOCKED; geometry is real.)
export async function generate(prompt, styleSeed = 0) {
  if (MOCK) {
    await wait(650);
    const model = generateBuilding(prompt, styleSeed);
    const brickModel = legolize(model, seedOf(prompt) + styleSeed);
    return { prompt, imageUrl: null, mock: true, model, brickModel };
  }
  // const r = await fetch("/api/generate-image", { method:"POST", headers:{...}, body: JSON.stringify({prompt}) });
  // ... then /generate-3d, then /legolize
  throw new Error("Backend not wired (set MOCK=false and implement)");
}

// Re-legolize an existing voxel model (e.g. after a recolor/restyle).
export async function relegolize(model, seed) {
  if (MOCK) { await wait(120); return legolize(model, seed >>> 0); }
  throw new Error("Backend not wired");
}
