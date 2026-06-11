// API layer. Talks to the FastAPI backend (proxied at /api -> :8000), which
// drives the two ComfyUI instances (FLUX :8188, TRELLIS :8189) and the Python
// legolizer. The backend is the single source of truth for the brick layout —
// the frontend never invents geometry; it renders what the backend returns.
import { adaptBrickModel } from "./lib/brickModel.js";

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

// drop null/undefined fields so the backend's tuned defaults apply
const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));

// Step 1 — a subject (+ optional reference photo) -> a real FLUX LEGO render.
// The `legoarch` trigger and the LEGO-set styling are added server-side.
// opts: { seed, steps, guidance, lora_scale } from the Tinker panel.
export async function generate(prompt, image = null, opts = {}) {
  const body = compact({ prompt, image_b64: image, ...opts });
  const { imageUrl, params } = await postJSON("/api/generate-image", body);
  // `params` echoes the RESOLVED values (incl. the actual random seed) so the
  // run is reproducible — surfaced on the reveal page + saved with the set.
  return { prompt, imageUrl, params: params || {} };
}

// Step 2 — the render -> TRELLIS smooth mesh (GPU, several minutes). The GLB
// travels by URL, not base64: quality exports are >10 MB and inlining them
// froze the browser. Pair with legolizeMesh() so brick settings can be
// retried in seconds. opts: { seed, shape_guidance, shape_steps }.
export async function generateMesh(imageDataUrl, opts = {}) {
  const r = await postJSON("/api/generate-mesh", compact({ image_b64: imageDataUrl, ...opts }));
  return { glbUrl: r.glbUrl || null, glbName: r.glbName || null, params: r.params || {} };
}

// Step 3 — the mesh -> plate voxels -> brick layout (CPU only, seconds).
// The mesh is referenced by name (server reads it from disk — nothing big
// travels). opts: { seed, voxel_target, legolize_options }.
export async function legolizeMesh(glbName, imageDataUrl, opts = {}) {
  const r = await postJSON("/api/legolize-mesh", compact({
    glb_name: glbName, image_b64: imageDataUrl, ...opts,
  }));
  return {
    voxel: r.voxel || null,
    brickModel: adaptBrickModel(r.brickModel),
    params: r.params || {},
  };
}

// Box/share copy from the 'set designer' persona (Claude if keyed, else template).
export async function getSetCopy(subject, brickModel) {
  const s = brickModel?.stability || {};
  return postJSON("/api/set-copy", {
    subject,
    n_bricks: s.nBricks || 0,
    n_parts: brickModel?.parts?.reduce((n, p) => n + p.qty, 0) || 0,
    n_colors: brickModel ? new Set(brickModel.bricks.map((b) => b.color)).size : 0,
    grid: brickModel?.grid || [],
    support_ratio: s.supportRatio ?? 1,
    connected: s.connected ?? true,
  });
}
