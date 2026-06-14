// Room 3 is not a room — it's a sprint. The legolize wait is ~9 seconds of
// OUR deterministic engine running, shown as a terse solver ticker under the
// voxelizing render, then straight into the assembly. No card deck, no stop
// button, no marquee: the contrast with the AI lounges IS the thesis —
// "no AI here, on purpose" made visible.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { VoxelSweep } from "./StageSquare.jsx";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { DUR, EASE } from "../lib/motion.js";
import { cn } from "../lib/cn.js";

// The REAL solver stages (see backend/app/legolizer) — labels, not fake logs.
const LINES = [
  { id: "voxel", text: "voxelize — slicing into plate-height voxels (8 × 8 × 3.2 mm)" },
  { id: "pack", text: "pack courses — split-and-merge, seams staggered like a mason" },
  { id: "color", text: "match colors — CIEDE2000 against the real LEGO palette" },
  { id: "prove", text: "prove stability — connectivity flood-fill + support check" },
];
const LINE_MS = 2100; // 4 lines ≈ the ~9s solve; the last line parks honestly

export default function SolverSprint({ imageUrl }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(1);

  useEffect(() => {
    const t = setInterval(
      () => setShown((n) => Math.min(n + 1, LINES.length)),
      LINE_MS
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex w-full flex-col items-center pb-10">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
        stage 3 of 3 · legolize — no AI here, on purpose
      </p>
      <h2 className="mt-1 font-display text-2xl font-black leading-tight text-on-dark">
        Solving the brick layout…
      </h2>

      <div
        className="relative mt-6 w-full overflow-hidden rounded-xl bg-elevated shadow-pop"
        style={{ maxWidth: "min(52vh, 540px)" }}
      >
        <div className="aspect-square w-full" />
        {imageUrl && <VoxelSweep imageUrl={imageUrl} fast />}
      </div>

      {/* the ticker: done lines check off, the live line keeps its ellipsis
          until the real solve returns and this whole screen exits */}
      <div className="mt-5 w-full max-w-[540px] font-mono text-sm leading-relaxed" aria-live="polite">
        {LINES.slice(0, shown).map((l, i) => {
          const live = i === shown - 1;
          return (
            <motion.p
              key={l.id}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: DUR.mod, ease: EASE.standard }}
              className={cn(
                "flex items-baseline gap-2",
                live ? "text-on-dark" : "text-on-dark-muted"
              )}
            >
              <span className="shrink-0 text-brand-yellow">{live ? "▸" : "✓"}</span>
              <span>
                {l.text}
                {live ? "…" : ""}
              </span>
            </motion.p>
          );
        })}
      </div>
    </div>
  );
}
