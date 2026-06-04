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

// Step 1: prompt (+ optional reference photo) -> real LEGO render + brick geometry.
// `image` is a data URL; when present the backend runs img2img instead of txt2img.
// The `legoarch` trigger is added server-side — users never type it.
export async function generate(prompt, image = null, styleSeed = 0) {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 650));
    const model = generateBuilding(prompt, styleSeed);
    return { prompt, imageUrl: null, mock: true, model, brickModel: legolize(model, seedOf(prompt) + styleSeed) };
  }
  // Real AI image from the backend (FLUX on :8188). img2img if a photo is attached.
  const body = image ? { prompt, image_b64: image } : { prompt };
  const { imageUrl } = await postJSON("/api/generate-image", body);
  // Geometry is still procedural; the brick pipeline below is real.
  const model = generateBuilding(prompt, styleSeed);
  const brickModel = legolize(model, seedOf(prompt) + styleSeed);
  return { prompt, imageUrl, mock: false, model, brickModel };
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// Step 2: a rendered LEGO image -> smooth 3D mesh (TRELLIS, :8189), then voxelize
// + legolize the REAL geometry. Returns { glbUrl, model, brickModel, voxelError }.
export async function generate3D(imageDataUrl) {
  if (MOCK) throw new Error("3D generation needs the backend (MOCK is on)");
  const r = await postJSON("/api/generate-3d", { image_b64: imageDataUrl });
  let model = null, brickModel = null;
  if (r.voxel) {
    model = { nx: r.voxel.nx, ny: r.voxel.ny, nz: r.voxel.nz, occ: b64ToBytes(r.voxel.occ_b64) };
    brickModel = legolize(model, ((r.voxel.nx * 73856093) ^ (r.voxel.nz * 19349663)) >>> 0);
  }
  return { glbUrl: r.glbUrl, model, brickModel, voxelError: r.voxelError };
}

// Re-legolize an existing voxel model (e.g. after a recolor/restyle). Real, local.
export async function relegolize(model, seed) {
  await new Promise((r) => setTimeout(r, 60));
  return legolize(model, seed >>> 0);
}
