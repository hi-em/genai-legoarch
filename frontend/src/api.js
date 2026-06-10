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

// Step 1 — a subject (+ optional reference photo) -> a real FLUX LEGO render.
// The `legoarch` trigger and the LEGO-set styling are added server-side.
export async function generate(prompt, image = null) {
  const body = image ? { prompt, image_b64: image } : { prompt };
  const { imageUrl } = await postJSON("/api/generate-image", body);
  return { prompt, imageUrl };
}

// Step 2 — the render -> TRELLIS smooth mesh -> voxelize -> legolize (all on the
// backend). Returns the GLB plus the REAL buildable brick model.
export async function generate3D(imageDataUrl, seed = null) {
  const r = await postJSON("/api/generate-3d", { image_b64: imageDataUrl, seed });
  return {
    glbUrl: r.glbUrl || null,
    voxel: r.voxel || null,
    brickModel: adaptBrickModel(r.brickModel),
    voxelError: r.voxelError || null,
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
