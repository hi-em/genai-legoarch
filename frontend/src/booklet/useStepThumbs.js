// Lazy, windowed renderer for the booklet's isometric step thumbs.
//
// `isoStepThumb` is O(visible bricks) — for a 10k-piece set with dozens of
// courses, rendering every course up front would block the main thread for
// seconds. Instead we render ONLY the courses near the spread the reader is
// looking at: [current-1 .. current+windowSize]. Renders happen one course per
// idle/rAF tick (never a burst), results are cached, and entries that drift far
// outside the window are evicted to cap memory. The shared `isoStepThumb` is
// the same renderer the PDF uses, so the flip view is pixel-identical to print.
import { useEffect, useRef, useState, useCallback } from "react";
import { isoStepThumb } from "../lib/isoThumb.js";

// requestIdleCallback isn't in every browser (Safari) — fall back to rAF.
const ric =
  typeof window !== "undefined" && window.requestIdleCallback
    ? window.requestIdleCallback.bind(window)
    : (cb) => requestAnimationFrame(() => cb({ timeRemaining: () => 8 }));
const cancelRic =
  typeof window !== "undefined" && window.cancelIdleCallback
    ? window.cancelIdleCallback.bind(window)
    : (id) => cancelAnimationFrame(id);

export function useStepThumbs(bm, currentSpread, windowSize = 3, sizePx = 520) {
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
    const lo = Math.max(0, currentSpread - 1);
    const hi = currentSpread + windowSize;
    const cache = cacheRef.current;

    // evict thumbs well outside the window so memory stays bounded
    let evicted = false;
    for (const course of cache.keys()) {
      if (course < lo - 1 || course > hi + 1) {
        cache.delete(course);
        evicted = true;
      }
    }

    // queue the in-window courses that aren't cached yet, nearest-first so the
    // page you're on resolves before its neighbours
    const want = [];
    for (let c = lo; c <= hi; c++) want.push(c);
    want.sort((a, b) => Math.abs(a - currentSpread) - Math.abs(b - currentSpread));
    queueRef.current = want.filter((c) => !cache.has(c));

    if (evicted) bump((v) => v + 1);

    const pump = (deadline) => {
      ricId.current = null;
      let did = false;
      // render while we have idle budget, but at least one per tick
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
  }, [bm, currentSpread, windowSize, sizePx]);

  // getter: returns the cached dataURL for a course, or null if still pending
  const getThumb = useCallback((course) => cacheRef.current.get(course) ?? null, []);

  return getThumb;
}
