import { create } from "zustand";

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
  brickModel: null,   // backend-legolized bricks + stability + parts
  setCopy: null,      // set-designer persona copy (name, blurb, quote, ...)
  set: (patch) => set(patch),
  reset: () => set({ prompt: "", imageUrl: null, brickModel: null, setCopy: null }),
}));
