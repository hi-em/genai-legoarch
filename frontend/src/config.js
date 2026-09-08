// Where the backend lives.
//
// In dev the Vite proxy rewrites /api -> http://127.0.0.1:8000, so the default
// empty base is correct and nothing needs configuring. A production BUILD has
// no proxy: the static bundle is served from a CDN and the backend is somewhere
// else entirely, so it needs the backend's absolute origin at build time.
//
//   VITE_API_BASE=https://legoarch-gpu.example.com   (no trailing slash)
//
// Leave it unset to ship the demo-only build: the site runs on the pre-baked
// sample and saved sets, and the GPU steps announce themselves as offline
// instead of failing with a network error. See docs/deploy.md.
const RAW = import.meta.env.VITE_API_BASE ?? "";

export const API_BASE = RAW.replace(/\/+$/, "");

// True when this build was pointed at a backend at all. A demo-only build
// (no VITE_API_BASE, production) can skip the probe entirely — there is
// nothing to reach.
export const HAS_BACKEND = import.meta.env.DEV || API_BASE !== "";

// Absolute URL for an /api path. Every backend call and every mesh <src> goes
// through here — nothing may hardcode "/api/..." any more, or it will 404 on
// the deployed site.
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
