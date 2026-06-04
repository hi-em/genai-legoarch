// API layer. Talks to the FastAPI backend (proxied at /api -> :8000), which
// drives the two ComfyUI instances (FLUX :8188, TRELLIS :8189).
//
// Status: the AI **image** is now REAL (FLUX.2 + legoarch). The voxel geometry
// is still procedural (generateBuilding) until the TRELLIS GLB -> voxelize ->
// legolize path is wired; the legolize / 3D-brick / export steps are real.
import { generateBuilding } from "./lib/voxel.js";
import { legolize } from "./lib/legolize.js";

export const MOCK = false;

const seedOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

async function postJSON(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${path} failed (${r.status}). Is ComfyUI running? ${detail.slice(0, 300)}`);
  }
  return r.json();
}

// Step 1: prompt -> real LEGO render (FLUX.2 + legoarch) + brick geometry.
export async function generate(prompt, styleSeed = 0) {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 650));
    const model = generateBuilding(prompt, styleSeed);
    return { prompt, imageUrl: null, mock: true, model, brickModel: legolize(model, seedOf(prompt) + styleSeed) };
  }
  // Real AI image from the backend (FLUX on :8188).
  const { imageUrl } = await postJSON("/api/generate-image", { prompt });
  // Geometry is still procedural; the brick pipeline below is real.
  const model = generateBuilding(prompt, styleSeed);
  const brickModel = legolize(model, seedOf(prompt) + styleSeed);
  return { prompt, imageUrl, mock: false, model, brickModel };
}

// Step 2 (optional): a rendered LEGO image -> smooth 3D mesh (TRELLIS, :8189).
// Returns { glbUrl } — a data: URL of the GLB for the 3D viewer / STL export.
export async function generate3D(imageDataUrl) {
  if (MOCK) throw new Error("3D generation needs the backend (MOCK is on)");
  return postJSON("/api/generate-3d", { image_b64: imageDataUrl });
}

// Re-legolize an existing voxel model (e.g. after a recolor/restyle). Real, local.
export async function relegolize(model, seed) {
  await new Promise((r) => setTimeout(r, 60));
  return legolize(model, seed >>> 0);
}
