import { create } from "zustand";
import { DEFAULTS } from "../hero/tinkerParams.js";

// ---------- global chrome: sound mute (read by lib/sound.js) ----------
const initMuted = (() => { try { return localStorage.getItem("lEgoarCh.muted") === "1"; } catch { return false; } })();
export const useUI = create((set) => ({
  muted: initMuted,
  toggleMute: () => set((s) => {
    const muted = !s.muted;
    try { localStorage.setItem("lEgoarCh.muted", muted ? "1" : "0"); } catch {}
    return { muted };
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
  while (list.length) {
    try { localStorage.setItem(SHELF_KEY, JSON.stringify(list)); return list; }
    catch { list = list.slice(0, list.length - 1); }   // drop oldest on quota error
  }
  try { localStorage.setItem(SHELF_KEY, "[]"); } catch {}
  return [];
}
export const useCollection = create((set, get) => ({
  items: loadShelf(),
  add: (item) => { const items = saveShelf([item, ...get().items]); set({ items }); },
  remove: (id) => { const items = saveShelf(get().items.filter((i) => i.id !== id)); set({ items }); },
}));

// ---------- top-level view switch (hero create flow <-> collection) ----------
export const useView = create((set) => ({
  view: "hero",
  show: (view) => set({ view }),
}));

// ---------- the current build flowing through the hero pipeline ----------
export const useBuild = create((set) => ({
  prompt: "",
  imageUrl: null,     // FLUX render (data URL)
  glbUrl: null,       // raw TRELLIS mesh (data URL) — powers the compare slider;
                      // NEVER persisted (a ~3MB GLB would blow the shelf quota)
  brickModel: null,   // backend-legolized bricks + stability + parts
  setCopy: null,      // set-designer persona copy (name, blurb, quote, ...)
  params: { ...DEFAULTS },  // Tinker slider values (survive "Forge another")
  seed: null,         // null = surprise me (backend rolls + echoes the seed)
  runRecord: null,    // reproducibility snapshot of the last successful forge:
                      // { prompt, seed, params, imageMs, modelMs, startedAt }
  set: (patch) => set(patch),
  setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  resetParams: () => set({ params: { ...DEFAULTS }, seed: null }),
  // keep params + seed across resets — a tuned dial should survive the next forge
  reset: () => set({ prompt: "", imageUrl: null, glbUrl: null, brickModel: null, setCopy: null, runRecord: null }),
}));
