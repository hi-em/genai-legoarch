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
const SHELF_KEY = "brickforge.shelf.v1";
function loadShelf() {
  try { return JSON.parse(localStorage.getItem(SHELF_KEY)) || []; } catch { return []; }
}
function saveShelf(items) {
  try { localStorage.setItem(SHELF_KEY, JSON.stringify(items)); } catch {}
}
export const useCollection = create((set, get) => ({
  items: loadShelf(),
  add: (item) => { const items = [item, ...get().items]; saveShelf(items); set({ items }); },
  remove: (id) => { const items = get().items.filter((i) => i.id !== id); saveShelf(items); set({ items }); },
}));

// ---------- current build flowing through the pipeline ----------
export const useBuild = create((set) => ({
  prompt: "",
  imageUrl: null,
  glbUrl: null,       // TRELLIS smooth 3D mesh (data URL), generated on demand
  model: null,        // voxel grid
  brickModel: null,   // legolized bricks + stability + parts
  busy: false,
  busy3d: false,
  set: (patch) => set(patch),
  reset: () => set({ prompt: "", imageUrl: null, glbUrl: null, model: null, brickModel: null, busy: false, busy3d: false }),
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
