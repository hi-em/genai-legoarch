// Room 1's whole show: YOUR prompt slotting into the 8-slot grammar, one
// slot every few seconds — timed to fill the ~35s render. Slots the parser
// recognizes in your words show them as chips; the rest fill as quiet bars
// (the enhancer writes those server-side). Silent on purpose — it fills on a
// timer, and a beep per slot through the wait reads as a slot machine.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GRAMMAR, TONE, parsePromptSlots } from "../lib/promptGrammar.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { cn } from "../lib/cn.js";

const ROW_MS = 3600; // 9 rows × 3.6s ≈ the ~34s image estimate — duration-matched

// solid dot color per grammar tone (TONE itself is the pill bg/text pairing)
const DOT = {
  yellow: "bg-brand-yellow",
  blue: "bg-brand-blue",
  red: "bg-brand-red",
  neutral: "bg-white/40",
};

export default function VisualizingCanvas({ prompt }) {
  const reduced = useReducedMotion();

  // map the user's RAW prompt onto the grammar — rich example prompts parse
  // into most slots; a bare landmark fills identity and leaves the rest to
  // the enhancer (shown as bars, honestly unlabelled)
  const rows = useMemo(() => {
    const parsed = parsePromptSlots(prompt);
    const byId = Object.fromEntries(parsed.map((s) => [s.id, s.text]));
    return [
      { id: "trigger", name: GRAMMAR.trigger.token, tone: GRAMMAR.trigger.tone, text: GRAMMAR.trigger.token },
      ...GRAMMAR.slots.map((s) => ({ id: s.id, name: s.name, tone: s.tone, text: byId[s.id] || null })),
    ];
  }, [prompt]);

  const [filled, setFilled] = useState(0);
  useEffect(() => {
    if (reduced) {
      setFilled(rows.length); // static: everything composed, no timers
      return;
    }
    setFilled(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > rows.length) return clearInterval(t);
      // no sound here: this fills on a timer (the machine talking, not the
      // user) and beeping through the wait reads as a slot machine.
      setFilled(n);
    }, ROW_MS);
    return () => clearInterval(t);
  }, [reduced, rows]);

  return (
    // fills the LoadingStage square wrapper (which owns aspect, radius, clip)
    <div className="absolute inset-0 flex flex-col justify-center bg-ink p-5">
      {/* faint stud grid — 22px ≈ on-screen stud pitch (shared with StageSquare) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1.2px, transparent 1.4px)",
          backgroundSize: "22px 22px",
          opacity: 0.06,
        }}
      />

      <div className="relative flex flex-col gap-1.5">
        {rows.map((row, i) => {
          const isFilled = i < filled;
          const isActive = i === filled && filled < rows.length;
          return (
            <div
              key={row.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-1 transition-opacity duration-slow",
                isActive && !reduced && "bg-white/5 ring-1 ring-brand-yellow/50",
                !isFilled && !isActive && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isFilled || isActive ? DOT[row.tone] || DOT.neutral : "bg-white/20"
                )}
              />
              <span
                className={cn(
                  "w-40 shrink-0 truncate text-nano font-bold uppercase tracking-widest",
                  isFilled ? "text-on-dark" : "text-on-dark-muted"
                )}
              >
                {row.name}
              </span>
              {isFilled && row.text ? (
                <motion.span
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "min-w-0 max-w-full truncate rounded-full px-2 py-0.5 text-micro font-bold",
                    TONE[row.tone] || TONE.neutral
                  )}
                >
                  {row.text}
                </motion.span>
              ) : isFilled ? (
                <motion.span
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-2 min-w-0 flex-1 rounded-full bg-white/25"
                />
              ) : (
                <span
                  className={cn(
                    "h-2 min-w-0 flex-1 rounded-full bg-white/10",
                    isActive && !reduced && "animate-pulse"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="absolute inset-x-0 bottom-3 text-center text-nano text-on-dark-muted">
        {filled >= rows.length
          ? "prompt composed — handing it to FLUX"
          : "composing your prompt, slot by slot"}
      </p>
    </div>
  );
}
