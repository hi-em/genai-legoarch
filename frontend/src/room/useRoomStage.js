import { create } from "zustand";

// The room's camera/interaction state machine — the single owner of "what is
// the camera doing and which box is in focus". Persistence (useCollection.add)
// is NOT here: the set is added up-front in HeroFlow, so this store only drives
// the staging → inspect → slide → free-walk choreography (and the wall-set
// focus → open → inspect path). Every transition is guarded by a mode check so
// a wall-clock failsafe firing late is a harmless no-op.
//
// modes:
//   free-walk   first-person walking (FpsControls mounted, CameraRig off)
//   packing     a freshly-forged set packs on the centre plinth
//   staged-idle packed, closed, waiting on the plinth (click to inspect)
//   inspecting  options menu / a panel (booklet|priced) is open
//   shelving    the closed box slides plinth → its wall slot
//   focusing    camera eases toward a wall set you walked up to
//   opening     that wall set plays its open animation

const FREE = { mode: "free-walk", staged: null, focus: null, panel: null, slide: null, slideTo: null };

export const useRoomStage = create((set, get) => ({
  ...FREE,

  // --- fresh set staged from the reveal (item already in useCollection at idx 0) ---
  beginStaging: ({ id, item }) =>
    set({ mode: "packing", staged: { id, item }, focus: { item, origin: "staging", slotIdx: 0 }, panel: null, slide: null, slideTo: null }),
  packingDone: () => { if (get().mode === "packing") set({ mode: "staged-idle" }); },

  // --- inspect (shared by staged + wall sets) ---
  openInspect: (panel = null) => {
    const m = get().mode;
    if (m === "staged-idle" || m === "inspecting" || m === "opening") set({ mode: "inspecting", panel });
  },
  closeInspect: () => { if (get().mode === "inspecting") set({ panel: null }); },

  // --- send the staged box to its wall slot ---
  beginShelving: (slideTo) => {
    const m = get().mode;
    if (m !== "staged-idle" && m !== "inspecting") return;
    set({ mode: "shelving", panel: null, slide: { t: 0 }, slideTo });
  },
  setSlideT: (t) => { if (get().slide) set({ slide: { t } }); },
  shelvingDone: () => { if (get().mode === "shelving") set({ ...FREE }); },

  // --- walk up to a wall set, open it, inspect it ---
  focusWallSet: (item, slotIdx) => { if (get().mode === "free-walk") set({ mode: "focusing", focus: { item, origin: "wall", slotIdx }, panel: null }); },
  arrivedAtWall: () => { if (get().mode === "focusing") set({ mode: "opening" }); },
  openingDone: () => { if (get().mode === "opening") set({ mode: "inspecting", panel: null }); },

  // --- always-available escape back to walking ---
  releaseToFreeWalk: () => set({ ...FREE }),
}));

if (import.meta.env?.DEV && typeof window !== "undefined") window.__bfRoom = useRoomStage;
