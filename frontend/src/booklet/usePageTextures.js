// Lazy GPU textures for the 3D book: builds a THREE.Texture only for the pages
// in (current spread ± windowSpreads), disposes the rest, and disposes all on
// unmount. dataUrlFor(i) returns the iso-step dataURL for page i (or null while
// it's still rendering / for non-iso pages the book supplies directly).
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export function usePageTextures(dataUrlFor, count, spread, windowSpreads = 1) {
  const map = useRef(new Map());
  const [, bump] = useState(0);

  useEffect(() => {
    const lo = Math.max(0, (spread - windowSpreads) * 2);
    const hi = Math.min(count - 1, (spread + windowSpreads + 1) * 2 + 1);
    const want = new Set();
    for (let i = lo; i <= hi; i++) want.add(i);

    for (const [i, t] of map.current) {
      if (!want.has(i)) { t.dispose(); map.current.delete(i); }
    }

    let alive = true;
    want.forEach((i) => {
      if (map.current.has(i)) return;
      const url = dataUrlFor(i);
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        const t = new THREE.Texture(img);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        t.needsUpdate = true;
        map.current.set(i, t);
        bump((n) => n + 1);
      };
      img.src = url;
    });
    return () => { alive = false; };
  }, [dataUrlFor, count, spread, windowSpreads]);

  useEffect(() => () => { for (const t of map.current.values()) t.dispose(); map.current.clear(); }, []);

  return (i) => map.current.get(i) || null;
}
