// Load a GLB delivered as a base64 data URL (the raw TRELLIS mesh from
// /generate-3d). Converting data URL -> Blob -> object URL once is much
// cheaper than letting the loader cache key on a multi-MB base64 string,
// and lets us revoke + dispose deterministically on unmount.
import { useEffect, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export function useDataUrlGLB(dataUrl) {
  const [state, setState] = useState({ scene: null, error: null });

  useEffect(() => {
    if (!dataUrl) {
      setState({ scene: null, error: null });
      return;
    }
    let cancelled = false;
    let objectUrl = null;
    let loadedScene = null;

    (async () => {
      try {
        const blob = await (await fetch(dataUrl)).blob();   // handles the data: header
        objectUrl = URL.createObjectURL(blob);
        const gltf = await new GLTFLoader().loadAsync(objectUrl);
        loadedScene = gltf.scene;
        if (!cancelled) setState({ scene: gltf.scene, error: null });
      } catch (e) {
        if (!cancelled) setState({ scene: null, error: e });
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    })();

    return () => {
      cancelled = true;
      if (loadedScene) {
        loadedScene.traverse((o) => {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            m.map?.dispose?.();
            m.dispose?.();
          }
        });
      }
    };
  }, [dataUrl]);

  return state;
}
