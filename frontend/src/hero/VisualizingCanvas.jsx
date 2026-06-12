// What fills the left square while FLUX renders: instead of a blank panel,
// the 8-slot prompt grammar as skeleton rows "lighting up" while the image
// composes — the trigger + every slot the enhancer writes, with the user's
// own words in the identity row. Pure presentation; the real progress story
// lives in LoadingTheater next to it.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GRAMMAR, TONE } from "../lib/promptGrammar.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { cn } from "../lib/cn.js";

// solid dot color per grammar tone (TONE itself is the pill bg/text pairing)
const DOT = {
  yellow: "bg-brand-yellow",
  blue: "bg-brand-blue",
  red: "bg-brand-red",
  neutral: "bg-white/40",
};

export default function VisualizingCanvas({ prompt }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  const rows = useMemo(
    () => [
      { id: "trigger", name: GRAMMAR.trigger.token, tone: GRAMMAR.trigger.tone },
      ...GRAMMAR.slots.map((s) => ({ id: s.id, name: s.name, tone: s.tone })),
    ],
    []
  );
  const identityText = (prompt || "").split(",")[0].trim();

  // a slow "active" highlight cycles the rows — static under reduced motion
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setActive((i) => (i + 1) % rows.length), 1200);
    return () => clearInterval(t);
  }, [reduced, rows.length]);

  return (
    <div className="relative flex aspect-square w-full flex-col justify-center rounded-xl bg-ink p-5">
      {/* faint stud grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1.2px, transparent 1.4px)",
          backgroundSize: "22px 22px",
          opacity: 0.06,
        }}
      />

      <div className="relative flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <motion.div
            key={row.id}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { delay: i * 0.35, duration: 0.4 }}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1",
              !reduced && i === active && "bg-white/5 ring-1 ring-brand-yellow/50"
            )}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[row.tone] || DOT.neutral)} />
            <span className="w-32 shrink-0 truncate text-nano font-bold uppercase tracking-widest text-on-dark-muted">
              {row.name}
            </span>
            {row.id === "identity" && identityText ? (
              <span className="min-w-0 flex-1 truncate text-micro text-on-dark">{identityText}</span>
            ) : (
              <span className={cn("h-2 min-w-0 flex-1 rounded-full bg-white/10", !reduced && "animate-pulse")} />
            )}
          </motion.div>
        ))}
      </div>

      <p className="absolute inset-x-0 bottom-3 text-center text-nano text-on-dark-muted">
        composing the prompt, slot by slot
      </p>
    </div>
  );
}
