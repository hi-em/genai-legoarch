// WebGL capability probe — used by the reveal's ▶ Pack ritual (HeroFlow) and the
// ShelfGate, so they can never disagree about whether the 3D paths can run.

export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
