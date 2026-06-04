import { create } from "zustand";

// Collection shelf state. M3: persist to backend (SQLite) or localStorage.
export const useCollection = create((set) => ({
  items: [], // { id, title, thumb, image_url, stl_url, brick_model, created_at }
  add: (item) => set((s) => ({ items: [item, ...s.items] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

// Current working build flowing through the pipeline (image -> 3D -> bricks).
export const useBuild = create((set) => ({
  prompt: "",
  imageUrl: null,
  stlUrl: null,
  voxelgridUrl: null,
  brickModel: null,
  set: (patch) => set(patch),
  reset: () => set({ prompt: "", imageUrl: null, stlUrl: null, voxelgridUrl: null, brickModel: null }),
}));
