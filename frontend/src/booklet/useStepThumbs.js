// Renderer for the booklet's isometric step thumbs — pre-render ALL pages once,
// then never re-render.
//
// `isoStepThumb` is O(visible bricks), so rendering every course in one burst
// would freeze the main thread for a 10k-piece set. Instead we queue every
// course and render ONE per idle/rAF tick (chunked → no freeze), nearest to the
// page you're on first, and CACHE FOR THE BOOKLET'S LIFETIME (no eviction). The
// result: the first pass fills in behind a skeleton, and every page turn after
// that — forward AND back — is instant, because the art was rendered once. The
// shared `isoStepThumb` is the same renderer the PDF uses, so the flip view is
// pixel-identical to print.
import { useEffect, useRef, useState, useCallback } from "react";
import { isoStepThumb } from "../lib/isoThumb.js";
import { courseCount } from "../lib/brickModel.js";

// requestIdleCallback isn't in every browser (Safari) — fall back to rAF.
const ric =
  typeof window !== "undefined" && window.requestIdleCallback
    ? window.requestIdleCallback.bind(window)
    : (cb) => requestAnimationFrame(() => cb({ timeRemaining: () => 8 }));
const cancelRic =
  typeof window !== "undefined" && window.cancelIdleCallback
    ? window.cancelIdleCallback.bind(window)
    : (id) => cancelAnimationFrame(id);

export function useStepThumbs(bm, currentSpread, _windowSize = 3, sizePx = 520) {
  // course -> dataURL. A ref holds the live cache (no re-render per insert);
  // a version counter triggers re-render once a tick produces something new.
  const cacheRef = useRef(new Map());
  const [, bump] = useState(0);
  const queueRef = useRef([]);
  const ricId = useRef(null);

  // Reset everything when the model or render size changes — old thumbs are stale.
  useEffect(() => {
    cacheRef.current = new Map();
    queueRef.current = [];
    bump((v) => v + 1);
  }, [bm, sizePx]);

  useEffect(() => {
    if (!bm) return;
    const total = courseCount(bm);   // every page lives in courses 0..total
    const cache = cacheRef.current;

    // queue EVERY not-yet-rendered course (no eviction), nearest-first so the
    // page you're on resolves before the rest of the pre-render fills in
    const want = [];
    for (let c = 0; c <= total; c++) if (!cache.has(c)) want.push(c);
    want.sort((a, b) => Math.abs(a - currentSpread) - Math.abs(b - currentSpread));
    queueRef.current = want;

    const pump = (deadline) => {
      ricId.current = null;
      let did = false;
      // render while we have idle budget, but at least one per tick (chunked
      // so the first pass never freezes the main thread)
      while (
        queueRef.current.length &&
        (!did || (deadline && deadline.timeRemaining && deadline.timeRemaining() > 4))
      ) {
        const course = queueRef.current.shift();
        if (!cache.has(course)) {
          cache.set(course, isoStepThumb(bm, course, sizePx, "#ffffff"));
          did = true;
        }
      }
      if (did) bump((v) => v + 1);
      if (queueRef.current.length) ricId.current = ric(pump);
    };

    if (queueRef.current.length) ricId.current = ric(pump);

    return () => {
      if (ricId.current != null) cancelRic(ricId.current);
      ricId.current = null;
    };
  }, [bm, currentSpread, sizePx]);

  // getter: returns the cached dataURL for a course, or null if still pending
  const getThumb = useCallback((course) => cacheRef.current.get(course) ?? null, []);

  return getThumb;
}
