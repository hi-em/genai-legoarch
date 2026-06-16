import { create } from "zustand";
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

// ---------- collection shelf — persisted to localStorage (survives reloads) ----------
// Each saved set carries its full brickModel + setCopy + a render thumbnail so it
// can be reopened (3D viewer + trophies) offline. Capped + quota-safe so a long
// collection of large sets can't exceed the ~5MB localStorage budget.
const SHELF_KEY = "lEgoarCh.shelf.v2";
const SHELF_CAP = 20;
function loadShelf() {
  try { return JSON.parse(localStorage.getItem(SHELF_KEY)) || []; } catch { return []; }
}
function saveShelf(items) {
  let list = items.slice(0, SHELF_CAP);
  if (list.length === 0) {                 // legitimately empty (e.g. removed the last set)
    try { localStorage.setItem(SHELF_KEY, "[]"); } catch {}
    return [];
  }
  while (list.length) {
    try { localStorage.setItem(SHELF_KEY, JSON.stringify(list)); return list; }
    catch { list = list.slice(0, list.length - 1); }   // drop oldest on quota pressure
  }
  // A single set alone exceeds the quota — DON'T wipe the shelf to "[]". Keep the
  // last good persisted collection; the caller reports the add as rejected.
  return loadShelf();
}
export const useCollection = create((set, get) => ({
  items: loadShelf(),
  // Returns { savedNew, dropped }: whether the NEW set actually persisted, and how
  // many OLDER sets quota-pressure evicted to make room — so the caller can be
  // honest (never claim "saved" when storage rejected it, never wipe the shelf).
  add: (item) => {
    const wanted = [item, ...get().items];
    const items = saveShelf(wanted);
    set({ items });
    const savedNew = items.some((i) => i.id === item.id);
    return { savedNew, dropped: savedNew ? Math.max(0, wanted.length - items.length) : 0 };
  },
  remove: (id) => { const items = saveShelf(get().items.filter((i) => i.id !== id)); set({ items }); },
  // Replace one set IN PLACE by stable id, preserving its position in the shelf.
  // Used when re-tuning a packed set: the tuned bricks overwrite the SAME entry
  // instead of being added as a new one (which would prepend + risk evicting the
  // oldest set). Count is preserved EXCEPT under genuine quota pressure (a tuned
  // model larger than before) — saveShelf then drops oldest to fit, so we report
  // `dropped` too (mirroring add) and the caller surfaces it honestly. Returns
  // { updated, dropped } so the caller can fall back to add() / tell the truth.
  update: (id, patch) => {
    const cur = get().items;
    if (!cur.some((i) => i.id === id)) return { updated: false, dropped: 0 };
    const items = saveShelf(cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    set({ items });
    const updated = items.some((i) => i.id === id);
    return { updated, dropped: updated ? Math.max(0, cur.length - items.length) : 0 };
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
