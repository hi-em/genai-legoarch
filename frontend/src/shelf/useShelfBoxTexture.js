// Refcounted module cache of shelf-box front textures, keyed by item.id.
// Each diorama box wants the same painted panel for as long as it's mounted;
// the cache builds it once (512px — ~0.76MB on the GPU), shares it between
// remounts, and disposes it when the last consumer unmounts. invalidate()
// nudges the demand frameloop when a texture resolves after first paint.
import { useEffect, useState } from "react";
import { invalidate } from "@react-three/fiber";
import { buildFrontTexture } from "../lib/boxTexture.js";

const cache = new Map(); // item.id -> { promise, tex, refs }

export function useShelfBoxTexture(item) {
  const [tex, setTex] = useState(() => cache.get(item.id)?.tex || null);

  useEffect(() => {
    let entry = cache.get(item.id);
    if (!entry) {
      entry = { refs: 0, tex: null, promise: null };
      entry.promise = buildFrontTexture({
        imageUrl: item.renderThumb || null, // NEVER item.thumb — its gradient bg half-keys
        setCopy: item.setCopy || { set_name: item.title, set_number: item.setNumber },
        pieces: item.nBricks,
        width: 512,
      }).then((t) => { entry.tex = t; return t; });
      cache.set(item.id, entry);
    }
    entry.refs += 1;

    let alive = true;
    entry.promise.then((t) => {
      if (alive) { setTex(t); invalidate(); }
    });

    return () => {
      alive = false;
      entry.refs -= 1;
      if (entry.refs <= 0) {
        cache.delete(item.id);
        entry.promise.then((t) => t.dispose());
      }
    };
  }, [item]);

  return tex;
}
