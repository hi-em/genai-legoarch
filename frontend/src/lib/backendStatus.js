// Is the generation pipeline reachable right now?
//
// The site is deployed permanently; the GPU behind it is not (a 16 GB card
// costs real money per hour, so it runs only during a demo). The frontend has
// to hold both truths at once: everything that needs no GPU keeps working, and
// everything that does says so up front instead of failing four minutes in.
import { useEffect, useState } from "react";
import { apiUrl, HAS_BACKEND } from "../config.js";

// A demo-only build (no VITE_API_BASE) knows it is offline without asking.
const OFFLINE = { backend: false, image: false, mesh: false, bricks: false, gpu: false };

let cached = null;      // one probe per page load, shared by every caller

export async function probeCapabilities() {
  if (!HAS_BACKEND) return OFFLINE;
  if (cached) return cached;
  try {
    // short timeout: an unreachable backend must not hold the intro screen
    // hostage — it should fall back to demo mode promptly
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(apiUrl("/api/capabilities"), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(String(r.status));
    cached = await r.json();
  } catch {
    cached = OFFLINE;   // unreachable backend is indistinguishable from a cold GPU here
  }
  return cached;
}

/** `{ caps, loading, refresh }` — caps is null only while the first probe is in flight.
 *  `refresh` re-asks: the GPU is something you switch ON mid-session, and the
 *  cached "offline" must not outlive it and force a page reload. */
export function useCapabilities() {
  const [caps, setCaps] = useState(cached);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    probeCapabilities().then((c) => { if (alive) setCaps(c); });
    return () => { alive = false; };
  }, []);

  async function refresh() {
    if (!HAS_BACKEND || checking) return;   // nothing to re-ask in a demo-only build
    setChecking(true);
    cached = null;
    const c = await probeCapabilities();
    setCaps(c);
    setChecking(false);
  }

  return { caps, loading: caps === null, checking, refresh };
}

/** True once we know the GPU stages cannot run. Undecided reads as "can". */
export const gpuOffline = (caps) => caps != null && !caps.gpu;
