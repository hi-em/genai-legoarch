// API layer. Talks to the FastAPI backend (proxied at /api -> :8000), which
// drives the two ComfyUI instances (FLUX :8188, TRELLIS :8189) and the Python
// legolizer. The backend is the single source of truth for the brick layout —
// the frontend never invents geometry; it renders what the backend returns.
import { adaptBrickModel } from "./lib/brickModel.js";
import { apiUrl } from "./config.js";

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
    const r = await fetch(apiUrl(path), {
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
  const r = await fetch(apiUrl(`/api/latest-mesh?since=${encodeURIComponent(sinceMs)}`));
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

// Last-resort box copy for when the backend cannot be reached at all (the
// demo-only deployment). Deliberately plain: the backend's own template
// fallback is the good one — this exists so the box art has a NAME instead of
// reading "set", not to imitate the set designer.
function offlineSetCopy(subject, brickModel) {
  const name = (subject || "Untitled Structure").split(",")[0].trim() || "Untitled Structure";
  const nParts = brickModel?.parts?.reduce((n, p) => n + p.qty, 0) || 0;
  return {
    set_name: name,
    set_number: null,
    box_blurb: `${name}, solved into ${nParts.toLocaleString()} real LEGO parts.`,
    designer_quote: null,
    value_verdict: null,
    share_tagline: `${name} — brick by brick.`,
  };
}

// Box/share copy from the 'set designer' persona (Claude if keyed, else template).
// Degrades to local copy rather than throwing: this is decoration, and losing it
// must never cost the user their reveal.
export async function getSetCopy(subject, brickModel) {
  try {
    return await requestSetCopy(subject, brickModel);
  } catch {
    return offlineSetCopy(subject, brickModel);
  }
}

async function requestSetCopy(subject, brickModel) {
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


// ---------- auth ----------
// The session is an HttpOnly cookie. Same-origin in production (FastAPI serves
// the SPA), so `credentials: "same-origin"` is the default and enough; it is
// spelled out here because a split-origin build would silently drop the cookie.
const CREDS = { credentials: "same-origin" };

export async function authConfig() {
  const r = await fetch(apiUrl("/api/auth/config"), CREDS);
  if (!r.ok) throw new ApiError(`auth/config failed (${r.status})`, { status: r.status });
  return r.json();
}

export async function fetchMe() {
  const r = await fetch(apiUrl("/api/auth/me"), CREDS);
  if (!r.ok) throw new ApiError(`auth/me failed (${r.status})`, { status: r.status });
  return r.json();
}

export async function postSignIn(credential) {
  return postJSON("/api/auth/session", { credential });
}

export async function postSignOut() {
  const r = await fetch(apiUrl("/api/auth/logout"), { method: "POST", ...CREDS });
  if (!r.ok) throw new ApiError(`logout failed (${r.status})`, { status: r.status });
  return r.json();
}

// ---------- the cloud shelf ----------
// The listing is the INDEX only (no brickModel) so the Collection grid stays
// cheap; a set's full payload is fetched when it is opened.
export async function fetchShelf() {
  const r = await fetch(apiUrl("/api/shelf"), CREDS);
  if (!r.ok) throw new ApiError(`shelf failed (${r.status})`, { status: r.status });
  return (await r.json()).items || [];
}

export async function fetchShelfItem(id) {
  const r = await fetch(apiUrl(`/api/shelf/${encodeURIComponent(id)}`), CREDS);
  if (!r.ok) {
    let code;
    try { code = (await r.json())?.detail?.code; } catch {}
    throw new ApiError(`shelf item failed (${r.status})`, { status: r.status, code });
  }
  return (await r.json()).item;
}

export async function putShelfItem(item) {
  const r = await fetch(apiUrl(`/api/shelf/${encodeURIComponent(item.id)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
    ...CREDS,
  });
  if (!r.ok) throw new ApiError(`shelf save failed (${r.status})`, { status: r.status });
  return r.json();
}

export async function deleteShelfItem(id) {
  const r = await fetch(apiUrl(`/api/shelf/${encodeURIComponent(id)}`), { method: "DELETE", ...CREDS });
  if (!r.ok) throw new ApiError(`shelf delete failed (${r.status})`, { status: r.status });
  return r.json();
}
