// Shared capability probes — one implementation used by both the reveal's
// "Pack & add to shelf" (HeroFlow) and the room gate, so they can never
// disagree about whether the 3D room can run.

export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function coarsePointer() {
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}
