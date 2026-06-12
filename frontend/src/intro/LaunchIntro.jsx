import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Wordmark from "../components/brand/Wordmark.jsx";
import { Button } from "../components/ui/index.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap } from "../lib/sound.js";
import { tileLayout, TILE_VMIN, MOSAIC_SCALE, MOSAIC_OPACITY } from "./introLayout.js";

// The 40 LoRA training photos, packed by scripts/build_intro_assets.mjs.
// Zero-padded names → lexicographic sort is dataset order.
const TILES = Object.entries(
  import.meta.glob("../intro-assets/*.webp", { eager: true, import: "default" })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, v]) => v);

const TAGLINE = "one custom LoRA · forty sets · one visual language";

// Beat timeline (ms from mount). "idle" is the implicit felt fade-in.
const ORDER = ["idle", "cascade", "converge", "wordmark", "dissolve"];
const TIMELINE = [
  ["cascade", 450],
  ["converge", 3000],
  ["wordmark", 3800],
  ["dissolve", 5600],
];
const DONE_AT = 6250; // dissolve (0.6s) finished
const FAST_DISSOLVE_MS = 320;

// vw/vh/vmin → px. Positions animate as plain numbers so framer-motion never
// has to interpolate across CSS units (vw → vmin isn't convertible mid-flight).
const vw = (v) => (v * window.innerWidth) / 100;
const vh = (v) => (v * window.innerHeight) / 100;
const vmin = (v) => (v * Math.min(window.innerWidth, window.innerHeight)) / 100;

/**
 * Launch intro montage: the 40 training photos cascade in from the viewport
 * edges, converge into a tight mosaic band, and the wordmark + tagline land
 * on top before the whole overlay dissolves to reveal the hero beneath.
 * Click or Escape skips. Reduced motion gets a static collage + Continue.
 */
export default function LaunchIntro({ onDone }) {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState("idle");
  const [fast, setFast] = useState(false);

  const idx = ORDER.indexOf(beat);
  const at = (name) => idx >= ORDER.indexOf(name);
  const dissolving = at("dissolve");

  const doneRef = useRef(false);
  const timersRef = useRef([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const fireDone = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.();
  };

  // Skip: jump to a fast dissolve (or straight out in the reduced variant).
  const skip = () => {
    if (doneRef.current) return;
    if (reduced) return fireDone();
    if (dissolving) return;
    timersRef.current.forEach(clearTimeout);
    setFast(true);
    setBeat("dissolve");
    timersRef.current = [setTimeout(fireDone, FAST_DISSOLVE_MS)];
  };
  const skipRef = useRef(skip);
  skipRef.current = skip;

  // Beat chain (or the reduced-motion auto-done), cleared on unmount.
  useEffect(() => {
    timersRef.current = reduced
      ? [setTimeout(fireDone, 2500)]
      : [
          ...TIMELINE.map(([name, ms]) => setTimeout(() => setBeat(name), ms)),
          setTimeout(fireDone, DONE_AT),
        ];
    return () => timersRef.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Escape skips.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && skipRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Per-tile layout, converted to px once at mount (the intro is too short to
  // bother tracking resizes).
  const layouts = useMemo(
    () =>
      TILES.map((_, i) => {
        const t = tileLayout(i, TILES.length);
        return {
          ...t,
          fromPx: { x: vw(t.from.xVw), y: vh(t.from.yVh) },
          gridPx: { x: vmin(t.grid.xVmin), y: vmin(t.grid.yVmin) },
          mosaicPx: { x: vmin(t.mosaic.xVmin), y: vmin(t.mosaic.yVmin) },
        };
      }),
    []
  );

  // ---- Reduced motion: static collage + wordmark + Continue --------------
  if (reduced) {
    return (
      <motion.div
        className="felt fixed inset-0 z-50 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div
          className="absolute inset-0 grid grid-cols-8 content-center gap-2 p-8 opacity-25"
          aria-hidden="true"
        >
          {TILES.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Wordmark className="text-5xl text-on-dark" />
          <p className="text-micro uppercase tracking-widest text-on-dark-muted">{TAGLINE}</p>
          <Button variant="nav" size="sm" className="mt-2" onClick={fireDone}>
            Continue
          </Button>
        </div>
      </motion.div>
    );
  }

  // ---- Full montage -------------------------------------------------------
  return (
    <motion.div
      className="felt fixed inset-0 z-50 cursor-pointer overflow-hidden"
      style={dissolving ? { pointerEvents: "none" } : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: dissolving ? 0 : 1 }}
      transition={{ duration: dissolving ? (fast ? 0.3 : 0.6) : 0.45, ease: "easeOut" }}
      onClick={skip}
    >
      {/* tiles, anchored to the viewport center */}
      <div className="absolute left-1/2 top-1/2" aria-hidden="true">
        {TILES.map((src, i) => {
          const L = layouts[i];
          const target = at("converge")
            ? { x: L.mosaicPx.x, y: L.mosaicPx.y, rotate: 0, scale: MOSAIC_SCALE, opacity: MOSAIC_OPACITY }
            : at("cascade")
            ? { x: L.gridPx.x, y: L.gridPx.y, rotate: 0, scale: 1, opacity: 1 }
            : { x: L.fromPx.x, y: L.fromPx.y, rotate: L.rot, scale: 1, opacity: 1 };
          const transition = at("converge")
            ? { duration: 1.0, ease: [0.3, 0, 0, 1], delay: i * 0.006 }
            : { type: "spring", stiffness: 110, damping: 17, mass: 0.9, delay: L.delay };
          return (
            <motion.img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="absolute rounded object-cover shadow-pop"
              style={{
                width: `${TILE_VMIN}vmin`,
                height: `${TILE_VMIN}vmin`,
                marginLeft: `-${TILE_VMIN / 2}vmin`,
                marginTop: `-${TILE_VMIN / 2}vmin`,
              }}
              initial={{ x: L.fromPx.x, y: L.fromPx.y, rotate: L.rot, scale: 1, opacity: 1 }}
              animate={target}
              transition={transition}
              // throttled brick-snap: one click per landed grid row
              onAnimationComplete={() => {
                if (beat === "cascade" && i % 8 === 0) playSnap();
              }}
            />
          );
        })}
      </div>

      {/* wordmark + tagline over the mosaic band */}
      {at("wordmark") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
          {/* clip-path sweep ≈ letter-by-letter reveal without reaching into Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 14, clipPath: "inset(0 100% 0 0)" }}
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 0.55, ease: [0.3, 0, 0, 1] }}
          >
            <Wordmark className="text-5xl text-on-dark" />
          </motion.div>
          <motion.p
            className="text-micro uppercase tracking-widest text-on-dark-muted"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6, ease: "easeOut" }}
          >
            {TAGLINE}
          </motion.p>
        </div>
      )}

      {/* skip hint */}
      {!dissolving && (
        <motion.div
          className="absolute bottom-4 right-5 z-10 text-nano text-on-dark-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          click or press esc to skip
        </motion.div>
      )}
    </motion.div>
  );
}
