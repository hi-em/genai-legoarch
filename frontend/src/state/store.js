import { create } from "zustand";

// Active tab / simple router.
export const useUI = create((set) => ({
  tab: "generate",
  setTab: (tab) => set({ tab }),
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
