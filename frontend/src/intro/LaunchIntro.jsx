import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Wordmark from "../components/brand/Wordmark.jsx";
import { WORDMARK } from "../components/brand/brand.js";
import { Button } from "../components/ui/index.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap } from "../lib/sound.js";
import LetterPlate from "./LetterPlate.jsx";
import { INTRO_SETS } from "./introSets.js";
import {
  tileLayout,
  GRID_COLS,
  TILE_RATIO,
  gridPitchPx,
  shuffledOrder,
  STAMP_SLOTS,
} from "./introLayout.js";

// The 40 LoRA training photos, packed by scripts/build_intro_assets.mjs.
// Zero-padded names → lexicographic sort is dataset order.
const TILES = Object.entries(
  import.meta.glob("../intro-assets/*.webp", { eager: true, import: "default" })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, v]) => v);

// l E g o a r C h — one letter per stamp slot, colors from the wordmark
const LETTERS = WORDMARK.flatMap((seg) => seg.t.split("").map((ch) => ({ ch, c: seg.c || null })));

const CAPTION_1 = "40 official LEGO Architecture sets trained one custom LoRA";
const CAPTION_2 = "together they taught the model one word";

// Beat timeline (ms from mount). The grid provably settles before the stamps:
// last tile launches 450 + 39×28 ≈ 1.54s, spring (170/22/0.9) rests ≈ 1s
// later → the full grid HOLDS ~850ms before the letter stamps begin. The
// intro never auto-exits — "hold" is indefinite until the user enters.
const ORDER = ["idle", "cascade", "stamp", "lockup", "hold"];
const TIMELINE = [
  ["cascade", 450],
  ["stamp", 3400],
  ["lockup", 4900],
  ["hold", 6100],
];
// Pacing multiplier on the gaps between beats (the beat animations keep their
// real timing). Default 1.25 = a slightly slower, more graceful ritual; override
// with ?introSlow=N (e.g. ?introSlow=1 for the original speed, =3 for review).
const SLOW = Number(new URLSearchParams(window.location.search).get("introSlow")) || 1.25;

const GLYPH_RATIO = 0.62; // mirror of LetterPlate's glyph sizing

/**
 * Launch ritual ("letter stamps"): the 40 training photos cascade in from the
 * viewport edges into a full grid; eight tiles flip into printed letter
 * plates that fly together and lock up as the lEgoarCh wordmark; the wall
 * dims and HOLDS — captions tell the LoRA story, hovering a tile names its
 * set, and "Enter the studio" is the only way in. Click/Esc/skip during the
 * beats jump straight to the hold. Plays on every load by design.
 */
export default function LaunchIntro({ onDone }) {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState("idle");
  const [fast, setFast] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [hovered, setHovered] = useState(null);
  const [charRects, setCharRects] = useState(null);

  const idx = ORDER.indexOf(beat);
  const at = (name) => idx >= ORDER.indexOf(name);
  const holding = beat === "hold";

  const doneRef = useRef(false);
  const timersRef = useRef([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const stackRef = useRef(null);
  const ctaWrapRef = useRef(null);
  const lastSnapRef = useRef(0);

  const fireDone = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    playSnap();   // the user's click unlocks audio — guarantee an audible snap on entry
    onDoneRef.current?.();
  };

  // Skip during the beats = jump to the HOLD state (fast tweens), never
  // straight out — the hold's Enter CTA is the only exit (plus Esc there).
  const skipToHold = () => {
    if (doneRef.current || holding) return;
    playSnap();   // first gesture into the hold — unlocks audio + a satisfying snap
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setFast(true);
    setBeat("hold");
  };

  const escRef = useRef(() => {});
  escRef.current = () => (holding || reduced ? fireDone() : skipToHold());
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && escRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Beat chain — cleared on unmount (survives StrictMode double-mount: the
  // first chain is fully cleared in the simulated unmount).
  useEffect(() => {
    if (reduced) return;
    timersRef.current = TIMELINE.map(([name, ms]) => setTimeout(() => setBeat(name), ms * SLOW));
    return () => timersRef.current.forEach(clearTimeout);
  }, [reduced]);

  // The hold is indefinite, so resizes must re-layout (debounced).
  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setVp({ w: window.innerWidth, h: window.innerHeight }), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Deterministic shuffle splits the dataset's adjacent duplicate views.
  const order = useMemo(() => shuffledOrder(TILES.length), []);
  const rows = Math.ceil(TILES.length / GRID_COLS);

  // Per-tile layout in px, recomputed on viewport change.
  const { tilePx, tiles } = useMemo(() => {
    const pitch = gridPitchPx(vp.w, vp.h, rows);
    const tile = pitch * TILE_RATIO;
    return {
      tilePx: tile,
      tiles: TILES.map((_, i) => {
        const t = tileLayout(i, TILES.length);
        return {
          ...t,
          fromPx: { x: (t.from.xVw * vp.w) / 100, y: (t.from.yVh * vp.h) / 100 },
          gridPx: { x: t.grid.ux * pitch, y: t.grid.uy * pitch },
        };
      }),
    };
  }, [vp, rows]);

  // Measure the 8 wordmark char rects (px from viewport center) once the
  // stamps begin — the center stack is always mounted at final layout, so
  // measured rects equal final rendered rects. Re-measures on resize.
  const measureOn = at("stamp");
  useEffect(() => {
    if (reduced || !measureOn) return;
    let on = true;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {}
      if (!on || !stackRef.current) return;
      const els = stackRef.current.querySelectorAll("[data-ch]");
      if (els.length !== LETTERS.length) return;
      setCharRects(
        [...els].map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2 - vp.w / 2, y: r.top + r.height / 2 - vp.h / 2, h: r.height };
        })
      );
    })();
    return () => {
      on = false;
    };
  }, [reduced, measureOn, vp]);

  // The hold's CTA is the natural tab stop — focus it on arrival.
  useEffect(() => {
    if (holding) ctaWrapRef.current?.querySelector("button")?.focus();
  }, [holding]);

  // Normal path: stamps are 110ms apart, so all 8 click — that's the rhythm.
  // The 90ms throttle only collapses the FAST skip path, where every flip
  // completes in the same frame and 8 simultaneous snaps would blare.
  const snapOnFlip = () => {
    const now = performance.now();
    if (now - lastSnapRef.current > 90) {
      lastSnapRef.current = now;
      playSnap();
    }
  };

  // ---- Reduced motion: static collage + wordmark + story + Enter ----------
  if (reduced) {
    return (
      <motion.div
        className="felt fixed inset-0 z-50 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="lEgoarCh launch intro"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div
          className="absolute inset-0 grid grid-cols-8 content-center gap-2 p-8 opacity-25"
          aria-hidden="true"
        >
          {order.map((srcIdx, i) => (
            <img
              key={i}
              src={TILES[srcIdx]}
              alt=""
              draggable={false}
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Wordmark className="text-5xl text-on-dark" />
          <p className="max-w-[520px] text-sm text-on-dark-muted">{CAPTION_1}</p>
          <p className="max-w-[520px] text-sm text-on-dark-muted">{CAPTION_2}</p>
          <Button variant="primary" className="mt-2" onClick={fireDone}>
            Enter the studio
          </Button>
        </div>
      </motion.div>
    );
  }

  // ---- Full ritual ---------------------------------------------------------
  return (
    <motion.div
      className={`felt fixed inset-0 z-50 overflow-hidden ${holding ? "" : "cursor-pointer"}`}
      role="dialog"
      aria-modal="true"
      aria-label="lEgoarCh launch intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      onClick={holding ? undefined : skipToHold}
    >
      {/* the wall of training photos, anchored to the viewport center */}
      <div
        className="absolute left-1/2 top-1/2"
        aria-hidden="true"
        onPointerLeave={() => setHovered(null)}
      >
        {TILES.map((_, i) => {
          const L = tiles[i];
          const stampIdx = STAMP_SLOTS.indexOf(i);
          const isStamp = stampIdx >= 0;
          const dimmed = at("lockup") && !isStamp;
          const isHover = holding && hovered === i;

          const target = at("cascade")
            ? {
                x: L.gridPx.x,
                y: L.gridPx.y,
                rotate: 0,
                scale: isHover ? 1.06 : 1,
                opacity: dimmed ? (isHover ? 0.95 : 0.3) : 1,
              }
            : { x: L.fromPx.x, y: L.fromPx.y, rotate: L.rot, scale: 1, opacity: 1 };

          const transition = fast
            ? { duration: 0.35, ease: [0.3, 0, 0, 1] }
            : beat === "cascade"
            ? { type: "spring", stiffness: 170, damping: 22, mass: 0.9, delay: L.delay }
            : { type: "spring", stiffness: 220, damping: 26, opacity: { duration: 0.6 } };

          return (
            <motion.div
              key={i}
              className="absolute"
              style={{
                width: tilePx,
                height: tilePx,
                marginLeft: -tilePx / 2,
                marginTop: -tilePx / 2,
                zIndex: isStamp ? 20 : undefined,
              }}
              initial={{ x: L.fromPx.x, y: L.fromPx.y, rotate: L.rot, scale: 1, opacity: 1 }}
              animate={target}
              transition={transition}
              onPointerEnter={holding ? () => setHovered(i) : undefined}
              // throttled brick-snap: one click per landed grid row
              onAnimationComplete={() => {
                if (beat === "cascade" && i % GRID_COLS === 0) playSnap();
              }}
            >
              {isStamp ? (
                <>
                  {/* the photo "returns" to the wall once its plate flies off */}
                  <motion.img
                    src={TILES[order[i]]}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 h-full w-full max-w-none rounded object-cover"
                    initial={false}
                    animate={{ opacity: at("lockup") ? 0.3 : 0 }}
                    transition={{ duration: 0.6 }}
                  />
                  <LetterPlate
                    ch={LETTERS[stampIdx].ch}
                    colorKey={LETTERS[stampIdx].c}
                    tilePx={tilePx}
                    beat={beat}
                    fast={fast}
                    flipDelay={stampIdx * 0.11}
                    photoSrc={TILES[order[i]]}
                    flight={
                      charRects
                        ? {
                            dx: charRects[stampIdx].x - L.gridPx.x,
                            dy: charRects[stampIdx].y - L.gridPx.y,
                            scale: charRects[stampIdx].h / (tilePx * GLYPH_RATIO),
                            delay: stampIdx * 0.03,
                          }
                        : null
                    }
                    onFlipDone={snapOnFlip}
                  />
                </>
              ) : (
                <img
                  src={TILES[order[i]]}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full max-w-none rounded object-cover shadow-pop"
                />
              )}
            </motion.div>
          );
        })}

        {/* one floating set-name chip for the hovered tile */}
        {holding && hovered != null && INTRO_SETS[order[hovered]] && (
          <div
            className="pointer-events-none absolute z-30"
            style={{
              transform: `translate(${tiles[hovered].gridPx.x}px, ${
                tiles[hovered].gridPx.y + tilePx / 2 + 10
              }px) translateX(-50%)`,
            }}
          >
            <span className="whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-nano font-semibold text-white">
              {INTRO_SETS[order[hovered]]}
            </span>
          </div>
        )}
      </div>

      {/* center stack: ALWAYS mounted at final layout (opacity 0 until the
          hold) so the 8 char rects can be measured before the lockup flight */}
      <div
        ref={stackRef}
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <motion.div
          style={{ visibility: holding ? "visible" : "hidden" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: holding ? 1 : 0 }}
          transition={{ duration: 0.3, delay: holding ? 0.25 : 0 }}
        >
          <Wordmark perChar className="text-5xl text-on-dark" />
        </motion.div>
        <motion.p
          className="max-w-[520px] text-sm text-on-dark-muted"
          style={{ visibility: holding ? "visible" : "hidden" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: holding ? 1 : 0, y: holding ? 0 : 6 }}
          transition={{ duration: 0.4, delay: holding ? 0.45 : 0 }}
        >
          {CAPTION_1}
        </motion.p>
        <motion.p
          className="max-w-[520px] text-sm text-on-dark-muted"
          style={{ visibility: holding ? "visible" : "hidden" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: holding ? 1 : 0, y: holding ? 0 : 6 }}
          transition={{ duration: 0.4, delay: holding ? 1.5 : 0 }}
        >
          {CAPTION_2}
        </motion.p>
        <motion.div
          ref={ctaWrapRef}
          className={holding ? "pointer-events-auto mt-1" : "mt-1"}
          style={{ visibility: holding ? "visible" : "hidden" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: holding ? 1 : 0, y: holding ? 0 : 6 }}
          transition={{ duration: 0.4, delay: holding ? 0.9 : 0 }}
        >
          <Button variant="primary" onClick={fireDone}>
            Enter the studio
          </Button>
          <p className="mt-2 text-nano text-on-dark-muted">hover a photo to meet the dataset</p>
        </motion.div>
      </div>

      {/* skip — jumps to the hold, not out */}
      {!holding && (
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            skipToHold();
          }}
          className="absolute bottom-4 right-5 z-10 text-nano text-on-dark-muted underline-offset-2 hover:underline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          skip intro — click or press esc
        </motion.button>
      )}
    </motion.div>
  );
}
