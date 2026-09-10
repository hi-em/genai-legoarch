import { create } from "zustand";
import { fetchShelf, fetchShelfItem, putShelfItem, deleteShelfItem } from "../api.js";
import { toast } from "../components/ui/index.js";
import { useAuth } from "../auth/useAuth.js";
import { DEFAULTS } from "../hero/tinkerParams.js";

// ---------- global chrome: sound mute (read by lib/sound.js) + brick cursor ----------
const initMuted = (() => { try { return localStorage.getItem("lEgoarCh.muted") === "1"; } catch { return false; } })();
// brick cursor defaults ON; only "0" turns it off (so first-time visitors get the fun touch)
const initCursor = (() => { try { return localStorage.getItem("lEgoarCh.cursor") !== "0"; } catch { return true; } })();
export const useUI = create((set) => ({
  muted: initMuted,
  toggleMute: () => set((s) => {
    const muted = !s.muted;
    try { localStorage.setItem("lEgoarCh.muted", muted ? "1" : "0"); } catch {}
    return { muted };
  }),
  cursor: initCursor,
  toggleCursor: () => set((s) => {
    const cursor = !s.cursor;
    try { localStorage.setItem("lEgoarCh.cursor", cursor ? "1" : "0"); } catch {}
    return { cursor };
  }),
}));

// ---------- collection shelf — the user's account, server-side ----------
// The shelf used to live in the visitor's IndexedDB, which meant it died with a
// cleared cache and never crossed devices. Now that signing in is required, the
// backend owns it: Firestore holds a light INDEX per set and Cloud Storage holds
// the payload, because a detail-48 build serializes to several MB and Firestore
// caps a document at 1 MiB (see backend/app/shelf_store.py).
//
// Consequences the UI has to respect:
//   · `items` is the INDEX — title, counts, thumbs. No brickModel.
//   · opening a set needs `ensureFull(id)` first; it merges the payload in.
//   · writes are OPTIMISTIC. The in-memory shelf updates now and the request
//     follows, so packing a set never blocks on a round trip.
const SHELF_CAP = 20;                     // hard cap on COUNT; mirrors the backend

// Two sets are "the same building" when their display titles match (case/space
// insensitive). Packing a new version of an existing building REPLACES it in
// place rather than piling up duplicates (see add()).
const sameName = (a, b) => {
  const ka = (a?.title || "").trim().toLowerCase();
  return !!ka && ka === (b?.title || "").trim().toLowerCase();
};

export const useCollection = create((set, get) => ({
  items: [],
  loaded: false,
  loadingId: null,        // a set whose payload is being fetched right now

  // Called once the user is signed in (App.jsx watches auth status).
  hydrate: async () => {
    try {
      const items = await fetchShelf();
      set({ items, loaded: true });
    } catch {
      set({ loaded: true });   // an empty shelf beats a spinner that never ends
    }
  },

  reset: () => set({ items: [], loaded: false, loadingId: null }),

  // Pull one set's full payload (brickModel, setCopy, runRecord) and merge it
  // into the in-memory item. No-op once loaded.
  ensureFull: async (id) => {
    const cur = get().items.find((i) => i.id === id);
    if (!cur || cur.brickModel) return cur || null;
    set({ loadingId: id });
    try {
      const full = await fetchShelfItem(id);
      set({
        items: get().items.map((i) => (i.id === id ? { ...i, ...full } : i)),
        loadingId: null,
      });
      return full;
    } catch {
      set({ loadingId: null });
      return null;
    }
  },

  // Returns { savedNew, dropped } synchronously — optimistic, the PUT follows.
  add: (item) => {
    const cur = get().items;
    const idx = cur.findIndex((i) => sameName(i, item));
    const merged = idx >= 0
      ? cur.map((i, k) => (k === idx ? item : i))   // same building → replace in place
      : [item, ...cur];                             // new building → prepend
    const items = merged.slice(0, SHELF_CAP);
    set({ items });
    // A guest has no account to write to. Pack is gated on sign-in (HeroFlow),
    // so this is a guard, not a path the UI walks: never fire a shelf write
    // that is guaranteed to 401.
    if (!useAuth.getState().user) return { savedNew: true, dropped: 0 };
    putShelfItem(item).catch(() => {
      // the server refused — don't leave a set on screen that isn't saved
      set({ items: get().items.filter((i) => i.id !== item.id) });
      toast.error("Couldn't save to your shelf", "Check your connection and pack it again.");
    });
    const savedNew = items.some((i) => i.id === item.id);
    return { savedNew, dropped: savedNew ? Math.max(0, merged.length - items.length) : 0 };
  },

  remove: (id) => {
    set({ items: get().items.filter((i) => i.id !== id) });
    if (useAuth.getState().user) deleteShelfItem(id).catch(() => {});
  },

  // Replace one set IN PLACE by stable id, preserving its position. Used when
  // re-tuning a packed set.
  update: (id, patch) => {
    const cur = get().items;
    const found = cur.find((i) => i.id === id);
    if (!found) return { updated: false, dropped: 0 };
    const next = { ...found, ...patch };
    set({ items: cur.map((i) => (i.id === id ? next : i)) });
    if (useAuth.getState().user) putShelfItem(next).catch(() => {});
    return { updated: true, dropped: 0 };
  },
}));

// ---------- top-level view switch (hero create flow <-> collection) ----------
export const useView = create((set) => ({
  view: "hero",
  show: (view) => set({ view }),
}));

// ---------- collection dupe guard ----------
export const isShelfDupe = (items, title, nBricks) =>
  items.some((i) => i.title === title && i.nBricks === nBricks);

// ---------- pending-job persistence (refresh recovery) ----------
const PENDING_KEY = "lEgoarCh.pendingJob.v1";
function loadPendingJob() {
  try {
    const j = JSON.parse(localStorage.getItem(PENDING_KEY));
    // ignore jobs older than 30 min — almost certainly dead
    if (!j || Date.now() - j.startedAt > 30 * 60 * 1000) return null;
    return j;
  } catch { return null; }
}
function savePendingJob(job) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(job)); } catch {} }
function clearPendingJob() { try { localStorage.removeItem(PENDING_KEY); } catch {} }

// ---------- the current build flowing through the hero pipeline ----------
// Flow control lives HERE, not in component state: `phase` is a pure
// derivation (derivePhase below), so navigation, HMR and refresh can never
// strand the UI in a state the data doesn't support.
export const useBuild = create((set, get) => ({
  prompt: "",
  imageUrl: null,     // FLUX render (data URL)
  glbUrl: null,       // raw TRELLIS mesh URL (/api/mesh/<name>) — compare slider
  glbName: null,      // mesh filename on the backend — re-legolize references it
  brickModel: null,   // backend-legolized bricks + stability + parts
  setCopy: null,      // set-designer persona copy (name, blurb, quote, ...)
  params: { ...DEFAULTS },  // Tinker slider values (survive "Visualize another")
  seed: null,         // null = surprise me (backend rolls + echoes the seed)
  runRecord: null,    // reproducibility snapshot of the last successful forge
  calls: null,        // the mesh-wait call sheet: { pieces, stable, colors }
                      // option ids (see hero/CallSheet.jsx BETS) — scored at
                      // reveal; survives re-materialize/re-legolize (the bet
                      // is on the FINAL set), cleared by a new render + reset()

  // ---- flow control: the single source of truth ----
  inFlight: null,     // null | "image" | "mesh" | "bricks"
  jobId: 0,           // monotonic; stale async completions are ignored
  abortCtrl: null,    // AbortController for the in-flight request
  tuning: false,      // user backed from reveal to the mesh stop ("Tune bricks")
  assembling: false,  // between legolize success and AssemblyViewer onComplete
  saved: false,       // current brickModel has been added to the shelf
  shelfId: null,      // stable id of THIS build's shelf entry once packed — so a
                      // re-tune + re-pack updates that entry in place instead of
                      // adding a duplicate (see HeroFlow onPack). Cleared on reset
                      // and when that entry is removed from the shelf.
  relegolizedSincePack: false, // a fresh, un-packed build is ready to Pack; true
                      // after a legolize/render/mesh, false on Pack + on entering
                      // "Tune bricks" — so Pack re-enables only after re-tune AND
                      // re-legolize (see HeroFlow onPack / the Pack button)
  pendingJob: loadPendingJob(), // recovery banner: {stage, prompt, startedAt, glbName?, imageThumb?}

  set: (patch) => set(patch),
  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  resetParams: () => set({ params: { ...DEFAULTS }, seed: null }),

  // ---- job lifecycle ----
  // MUST set inFlight synchronously, before any await — that IS the
  // double-click guard (AnimatePresence keeps exiting sections clickable).
  startJob: (kind, persist = {}) => {
    const jobId = get().jobId + 1;
    const abortCtrl = new AbortController();
    set({ inFlight: kind, jobId, abortCtrl, pendingJob: null });
    savePendingJob({ stage: kind, startedAt: Date.now(), ...persist });
    return { jobId, signal: abortCtrl.signal };
  },
  finishJob: (jobId, patch) => {
    if (get().jobId !== jobId) return false;          // stale completion — ignore
    clearPendingJob();
    set({ inFlight: null, abortCtrl: null, ...patch });
    return true;
  },
  failJob: (jobId, patch = {}) => {
    if (get().jobId !== jobId) return false;
    clearPendingJob();
    set({ inFlight: null, abortCtrl: null, ...patch }); // NO phase rewind — derivation handles it
    return true;
  },
  cancelJob: () => {
    get().abortCtrl?.abort();
    clearPendingJob();
    set({ inFlight: null, abortCtrl: null, jobId: get().jobId + 1 }); // bump: late responses are discarded
  },
  dismissPendingJob: () => { clearPendingJob(); set({ pendingJob: null }); },

  // keep params + seed across resets — a tuned dial should survive the next forge.
  // jobId bumps so a still-running request (or its setCopy follow-up) can't
  // write into the fresh build.
  reset: () => {
    clearPendingJob();
    set((s) => ({
      prompt: "", imageUrl: null, glbUrl: null, glbName: null, brickModel: null,
      setCopy: null, runRecord: null, calls: null,
      inFlight: null, abortCtrl: null, tuning: false, assembling: false, saved: false,
      shelfId: null,
      relegolizedSincePack: false,
      pendingJob: null, jobId: s.jobId + 1,
    }));
  },
}));

if (import.meta.env?.DEV && typeof window !== "undefined") window.__bfBuild = useBuild;

// Pure derivation: phase is a VIEW of store state, never stored. Failure
// paths fall out automatically — failJob only clears inFlight, so the user
// lands at the furthest stop whose data still exists.
export function derivePhase(s) {
  if (s.inFlight === "image") return "rendering";
  if (s.inFlight === "mesh") return "meshing";
  if (s.inFlight === "bricks") return "legolizing";
  if (s.brickModel) {
    if (s.tuning) return "mesh";       // reveal -> "Tune bricks" back-nav
    if (s.assembling) return "assembling";
    return "reveal";
  }
  if (s.glbUrl) return "mesh";
  if (s.imageUrl) return "render";
  return "intro";
}
