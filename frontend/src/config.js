// Where the backend lives.
//
// In dev the Vite proxy rewrites /api -> http://127.0.0.1:8000, so the default
// empty base is correct and nothing needs configuring. A production BUILD has
// no proxy: the static bundle is served from a CDN and the backend is somewhere
// else entirely, so it needs the backend's absolute origin at build time.
//
//   VITE_API_BASE=https://legoarch-gpu.example.com   (no trailing slash)
//
// Leave it unset for the one-origin container (the API is at /api on the
// same host). Set VITE_DEMO_ONLY=1 for a static demo bundle with no backend
// at all: the site then runs on the pre-baked sample and saved sets, and the
// generation steps announce themselves as offline. See docs/deploy.md.
const RAW = import.meta.env.VITE_API_BASE ?? "";

export const API_BASE = RAW.replace(/\/+$/, "");

// True when this build has a backend to ask. The deployed container serves
// the SPA and the API from ONE origin (docs/deploy.md), so an empty
// VITE_API_BASE does not mean "no backend" — it means "same origin". Only a
// build explicitly marked demo-only (VITE_DEMO_ONLY=1: a static bundle on a
// CDN with nothing behind it) skips the capabilities probe; everyone else
// asks, and an unreachable backend simply reads as offline after the probe's
// 4 s timeout.
export const HAS_BACKEND = import.meta.env.VITE_DEMO_ONLY !== "1";

// Absolute URL for an /api path. Every backend call and every mesh <src> goes
// through here — nothing may hardcode "/api/..." any more, or it will 404 on
// the deployed site.
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
