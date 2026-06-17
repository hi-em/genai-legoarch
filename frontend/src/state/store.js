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

// ---------- collection shelf — persisted to IndexedDB (survives reloads) ----------
// Each saved set carries its full brickModel + setCopy + a render thumbnail so it
// can be reopened (3D viewer + trophies) offline. A single flagship build (a
// detail-48 model can be tens of thousands of bricks) serializes to several MB —
// past localStorage's ~5 MB budget — so the shelf lives in IndexedDB, whose quota
// is hundreds of MB to GB. That is what lets a real collection of large sets
// coexist: a big new set NEVER has to evict the others to fit. (The old
// localStorage shelf dropped the oldest sets on quota pressure, silently deleting
// unrelated buildings — e.g. packing two large sets wiped Sagrada/Muralla.)
const SHELF_KEY = "lEgoarCh.shelf.v2";   // legacy localStorage key (migrated in once)
const SHELF_CAP = 20;                     // hard cap on COUNT (≥10); never byte-evicts

// -- IndexedDB key/value: one record holds the whole shelf array --
const IDB_DB = "lEgoarCh", IDB_STORE = "kv", IDB_KEY = "shelf.v2";
let _idb = null;
function openIdb() {
  if (_idb) return _idb;
  _idb = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-idb")); return; }
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _idb;
}
function idbGet() {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const rq = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
    rq.onsuccess = () => resolve(rq.result ?? null);
    rq.onerror = () => reject(rq.error);
  }));
}
function idbSet(items) {
  return openIdb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(items, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// localStorage fallback — node tests + browsers without IndexedDB. Best-effort:
// a too-large set just won't persist here, but it NEVER drops the other sets.
function lsLoad() { try { return JSON.parse(localStorage.getItem(SHELF_KEY)) || []; } catch { return []; } }
function lsSave(items) { try { localStorage.setItem(SHELF_KEY, JSON.stringify(items)); } catch {} }

// Persist the whole shelf. IndexedDB is the source of truth; fall back to
// localStorage only where IDB is unavailable. Async + fire-and-forget — the
// in-memory store is what the UI reads, so a write is never lost mid-session.
function persistShelf(items) { idbSet(items).catch(() => lsSave(items)); }

// Two sets are "the same building" when their display titles match (case/space
// insensitive). Packing a new version of an existing building REPLACES it in
// place rather than piling up duplicates (see add()).
const sameName = (a, b) => {
  const ka = (a?.title || "").trim().toLowerCase();
  return !!ka && ka === (b?.title || "").trim().toLowerCase();
};

export const useCollection = create((set, get) => ({
  // Instant first paint from the legacy localStorage shelf (if any); hydrate()
  // then swaps in the authoritative IndexedDB copy and migrates legacy data.
  items: lsLoad(),
  hydrate: async () => {
    try {
      const fromIdb = await idbGet();
      if (Array.isArray(fromIdb)) { set({ items: fromIdb.slice(0, SHELF_CAP) }); return; }
      // first run on IndexedDB — migrate whatever the old localStorage shelf had
      const legacy = lsLoad();
      if (legacy.length) { set({ items: legacy.slice(0, SHELF_CAP) }); idbSet(legacy).catch(() => {}); }
    } catch { /* no IndexedDB — keep the localStorage items already loaded */ }
  },
  // Returns { savedNew, dropped }. The new set ALWAYS saves (IndexedDB has room);
  // `dropped` is only ever >0 if the shelf was already at the hard COUNT cap.
  // If a set with the SAME name exists it is replaced in place — no duplicate and
  // no eviction of other buildings; otherwise the new set is prepended.
  add: (item) => {
    const cur = get().items;
    const idx = cur.findIndex((i) => sameName(i, item));
    const merged = idx >= 0
      ? cur.map((i, k) => (k === idx ? item : i))   // same building → replace in place
      : [item, ...cur];                             // new building → prepend
    const items = merged.slice(0, SHELF_CAP);
    set({ items });
    persistShelf(items);
    const savedNew = items.some((i) => i.id === item.id);
    return { savedNew, dropped: savedNew ? Math.max(0, merged.length - items.length) : 0 };
  },
  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    set({ items });
    persistShelf(items);
  },
  // Replace one set IN PLACE by stable id, preserving its position. Used when
  // re-tuning a packed set. Never drops another set (IndexedDB has room), so
  // `dropped` is always 0; the shape mirrors add() for the caller.
  update: (id, patch) => {
    const cur = get().items;
    if (!cur.some((i) => i.id === id)) return { updated: false, dropped: 0 };
    const items = cur.map((i) => (i.id === id ? { ...i, ...patch } : i));
    set({ items });
    persistShelf(items);
    return { updated: true, dropped: 0 };
  },
}));

// Pull the authoritative shelf out of IndexedDB once, on load (browser only).
if (typeof window !== "undefined") useCollection.getState().hydrate();

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
