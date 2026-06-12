// API layer. Talks to the FastAPI backend (proxied at /api -> :8000), which
// drives the two ComfyUI instances (FLUX :8188, TRELLIS :8189) and the Python
// legolizer. The backend is the single source of truth for the brick layout —
// the frontend never invents geometry; it renders what the backend returns.
import { adaptBrickModel } from "./lib/brickModel.js";

// Typed error: `code` carries the backend's detail.code (e.g. "mesh_not_found")
// so callers can steer the user instead of dumping raw text.
export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const SANITY_TIMEOUT_MS = 15 * 60 * 1000; // matches the backend's 900s httpx timeout

// combine a caller signal with our sanity timeout (AbortSignal.any needs
// Chrome 116+/Safari 17.4+; fall back to a manual listener elsewhere)
function combineSignals(signal, timeoutCtrl) {
  if (!signal) return timeoutCtrl.signal;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeoutCtrl.signal]);
  signal.addEventListener("abort", () => timeoutCtrl.abort(signal.reason), { once: true });
  return timeoutCtrl.signal;
}

async function postJSON(path, body, { signal } = {}) {
  const timeoutCtrl = new AbortController();
  const timer = setTimeout(
    () => timeoutCtrl.abort(new DOMException("Timed out after 15 minutes", "TimeoutError")),
    SANITY_TIMEOUT_MS
  );
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: combineSignals(signal, timeoutCtrl),
    });
    if (!r.ok) {
      let code, detail = "";
      try {
        const j = await r.json();
        code = j?.detail?.code;
        detail = typeof j?.detail === "string" ? j.detail : JSON.stringify(j?.detail ?? j);
      } catch {
        detail = await r.text().catch(() => "");
      }
      throw new ApiError(`${path} failed (${r.status}). ${detail.slice(0, 300)}`, { status: r.status, code });
    }
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

// drop null/undefined fields so the backend's tuned defaults apply
const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));

// Step 1 — a subject (+ optional reference photo) -> a real FLUX LEGO render.
// The `legoarch` trigger and the LEGO-set styling are added server-side.
// opts: { seed, steps, guidance, lora_scale } from the Tinker panel.
export async function generate(prompt, image = null, opts = {}) {
  const { signal, ...rest } = opts;
  const body = compact({ prompt, image_b64: image, ...rest });
  const { imageUrl, params } = await postJSON("/api/generate-image", body, { signal });
  // `params` echoes the RESOLVED values (incl. the actual random seed) so the
  // run is reproducible — surfaced on the reveal page + saved with the set.
  return { prompt, imageUrl, params: params || {} };
}

// Step 2 — the render -> TRELLIS smooth mesh (GPU, several minutes). The GLB
// travels by URL, not base64: quality exports are >10 MB and inlining them
// froze the browser. Pair with legolizeMesh() so brick settings can be
// retried in seconds. opts: { seed, shape_guidance, shape_steps }.
export async function generateMesh(imageDataUrl, opts = {}) {
  const { signal, ...rest } = opts;
  const r = await postJSON("/api/generate-mesh", compact({ image_b64: imageDataUrl, ...rest }), { signal });
  return { glbUrl: r.glbUrl || null, glbName: r.glbName || null, params: r.params || {} };
}

// Refresh recovery: newest GLB the backend finished after `sinceMs`.
// Throws ApiError(code "no_mesh") when nothing new exists yet.
export async function latestMesh(sinceMs) {
  const r = await fetch(`/api/latest-mesh?since=${encodeURIComponent(sinceMs)}`);
  if (!r.ok) {
    let code;
    try { code = (await r.json())?.detail?.code; } catch {}
    throw new ApiError(`latest-mesh failed (${r.status})`, { status: r.status, code });
  }
  return r.json(); // { glbName, glbUrl, mtimeMs }
}

// Step 3 — the mesh -> plate voxels -> brick layout (CPU only, seconds).
// The mesh is referenced by name (server reads it from disk — nothing big
// travels). opts: { seed, voxel_target, legolize_options }.
export async function legolizeMesh(glbName, imageDataUrl, opts = {}) {
  const { signal, ...rest } = opts;
  const r = await postJSON("/api/legolize-mesh", compact({
    glb_name: glbName, image_b64: imageDataUrl, ...rest,
  }), { signal });
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
