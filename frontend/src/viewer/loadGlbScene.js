// One-shot GLB scene loader for export flows (STL download). Unlike the
// useDataUrlGLB hook this is imperative: load -> use -> dispose. GLTFLoader
// handles data URLs, blob URLs, and /api/mesh/{name} paths directly, so we
// pass the url straight through. Matches the loader import style of
// useDataUrlGLB.js.
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { downloadStl } from "../lib/stl.js";

// Resolve the GLTF scene (a THREE.Group). Rejects on load error.
export async function loadGlbScene(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

// Free GPU resources for a subtree: geometries, materials, and material maps.
export function disposeScene(object3d) {
  if (!object3d) return;
  object3d.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const v of Object.values(m)) {
        if (v && v.isTexture) v.dispose?.();
      }
      m.dispose?.();
    }
  });
}

// UI convenience: load the GLB at `url`, export it as `filename`.stl, then
// dispose. Throws on load failure so callers can surface a toast.
export async function downloadMeshStl(url, filename) {
  const scene = await loadGlbScene(url);
  try {
    downloadStl(filename, scene);
  } finally {
    disposeScene(scene);
  }
}
