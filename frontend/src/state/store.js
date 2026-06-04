import { create } from "zustand";

// Active tab / simple router + global sound mute.
const initMuted = (() => { try { return localStorage.getItem("lEgoarCh.muted") === "1"; } catch { return false; } })();
export const useUI = create((set) => ({
  tab: "generate",
  setTab: (tab) => set({ tab }),
  muted: initMuted,
  toggleMute: () => set((s) => {
    const muted = !s.muted;
    try { localStorage.setItem("lEgoarCh.muted", muted ? "1" : "0"); } catch {}
    return { muted };
  }),
}));

const SHELF_KEY = "brickforge.shelf.v1";
function loadShelf() {
  try { return JSON.parse(localStorage.getItem(SHELF_KEY)) || []; } catch { return []; }
}
function saveShelf(items) {
  try { localStorage.setItem(SHELF_KEY, JSON.stringify(items)); } catch {}
}

// Collection shelf — persisted to localStorage so it survives reloads (M3).
export const useCollection = create((set, get) => ({
  items: loadShelf(),
  add: (item) => {
    const items = [item, ...get().items];
    saveShelf(items);
    set({ items });
  },
  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    saveShelf(items);
    set({ items });
  },
}));

// Current build flowing through the pipeline: prompt -> voxel model -> bricks.
export const useBuild = create((set) => ({
  prompt: "",
  imageUrl: null,
  model: null,        // voxel grid
  brickModel: null,   // legolized bricks + stability + parts
  busy: false,
  set: (patch) => set(patch),
  reset: () => set({ prompt: "", imageUrl: null, model: null, brickModel: null, busy: false }),
}));
