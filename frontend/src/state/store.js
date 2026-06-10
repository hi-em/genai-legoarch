import { create } from "zustand";

// ---------- global chrome: sound mute ----------
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

// ---------- current build flowing through the pipeline ----------
export const useBuild = create((set) => ({
  prompt: "",
  imageUrl: null,
  glbUrl: null,       // TRELLIS smooth 3D mesh (data URL), generated on demand
  model: null,        // voxel grid
  brickModel: null,   // legolized bricks + stability + parts
  setCopy: null,      // set-designer persona copy (name, blurb, quote, ...)
  busy: false,
  busy3d: false,
  set: (patch) => set(patch),
  reset: () => set({ prompt: "", imageUrl: null, glbUrl: null, model: null, brickModel: null, setCopy: null, busy: false, busy3d: false }),
}));

// ---------- canvas navigation (the "play-table" world) ----------
export const BUILD_ORDER = ["generate", "viewer", "studio"];

// Progress is DERIVED from the build state — one source of truth, no drift.
export function canEnter(id) {
  const { brickModel } = useBuild.getState();
  if (id === "viewer" || id === "studio") return !!brickModel;
  return true; // generate, shelf, playground are always reachable
}
export function progressOf(id) {
  const { brickModel, glbUrl } = useBuild.getState();
  if (id === "generate") return brickModel ? "done" : "active";
  if (id === "viewer") return !brickModel ? "locked" : glbUrl ? "done" : "active";
  if (id === "studio") return brickModel ? "active" : "locked";
  return "active"; // shelf / playground — neutral
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Drives the React Flow canvas. `rf` is the React Flow instance (registered by
// the Flow component); focus/overview/next fly the viewport smoothly and select
// the target node (selection = live 3D + resize handles).
export const useCanvas = create((set, get) => ({
  focusedZone: null,         // the selected/centred zone (null = overview)
  rf: null,                  // React Flow instance

  registerApi: (rf) => set({ rf }),
  setFocused: (id) => set({ focusedZone: id }),

  // Smoothly fly to a zone and select it.
  focus: (id) => {
    const { rf } = get();
    if (rf) {
      rf.setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
      rf.fitView({ nodes: [{ id }], duration: prefersReduced() ? 0 : 900, padding: 0.28 });
    }
    set({ focusedZone: id });
    return true;
  },

  // Zoom out to frame the whole table.
  overview: () => {
    const { rf } = get();
    if (rf) {
      rf.setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
      rf.fitView({ duration: prefersReduced() ? 0 : 900, padding: 0.12 });
    }
    set({ focusedZone: null });
  },

  // Advance the build pipeline to the next unlocked step.
  next: () => {
    const idx = BUILD_ORDER.indexOf(get().focusedZone);
    for (let i = idx + 1; i < BUILD_ORDER.length; i++) {
      if (canEnter(BUILD_ORDER[i])) return get().focus(BUILD_ORDER[i]);
    }
    return false;
  },
}));
