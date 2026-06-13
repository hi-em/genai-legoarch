// The waiting-room stage: a full-width marquee (stage eyebrow + step
// headline + ONE honest progress bar with stud ticks) over a two-column
// floor — the big square artifact on the left, the fanned card hand on the
// right, and a quiet stop footer. Backend calls are synchronous awaits with
// no progress events, so pacing is time-based per stage (SSE is the upgrade
// path); the REAL signals — render arriving, mesh arriving — flip the stage
// from outside via the store.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { STAGE_TRACKS, STAGE_META, eduCards } from "./loadingContent.js";
import CardHand from "./CardHand.jsx";
import { Button } from "../components/ui/index.js";
import { DUR, EASE } from "../lib/motion.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { cn } from "../lib/cn.js";

// ---- progress -------------------------------------------------------------

// Walk the est-timeline of a track; each step's bar share eases to 90% of the
// step then PARKS — only the real await finishing moves the stage on.
function useStageProgress(track, reduced) {
  const [stepIdx, setStepIdx] = useState(0);
  const [stepP, setStepP] = useState(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    startRef.current = performance.now();
    setStepIdx(0);
    setStepP(0);
  }, [track]);

  useEffect(() => {
    if (reduced) return; // reduced motion: static studs, no timers
    const steps = STAGE_TRACKS[track]?.steps;
    if (!steps) return; // unknown track (forced state) — quiet no-op
    const timer = setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      let acc = 0,
        idx = steps.length - 1,
        p = 0.9;
      for (let i = 0; i < steps.length; i++) {
        if (elapsed < acc + steps[i].estMs) {
          idx = i;
          p = (elapsed - acc) / steps[i].estMs;
          break;
        }
        acc += steps[i].estMs;
      }
      setStepIdx(idx);
      setStepP(Math.min(0.9, p)); // ease toward 90% and PARK
    }, 250);
    return () => clearInterval(timer);
  }, [track, reduced]);

  return { stepIdx, stepP };
}

function Marquee({ track, prompt, reduced }) {
  const trackDef = STAGE_TRACKS[track];
  const { stepIdx: rawIdx, stepP } = useStageProgress(track, reduced);
  if (!trackDef) return null; // unknown track — render nothing, never throw
  const { steps, totalHint } = trackDef;
  // clamp: stepIdx state can outlive a track switch for one render (the reset
  // effect runs AFTER render) — without this, image(3 steps)→mesh(2) crashes
  const stepIdx = Math.min(rawIdx, steps.length - 1);
  const step = steps[stepIdx];
  const meta = STAGE_META[track];

  const total = steps.reduce((a, s) => a + s.estMs, 0);
  // stud ticks sit at each step's START along the bar
  let acc = 0;
  const ticks = steps.map((s) => {
    const left = acc / total;
    acc += s.estMs;
    return { id: s.id, left };
  });
  const fillFrac =
    (steps.slice(0, stepIdx).reduce((a, s) => a + s.estMs, 0) + stepP * steps[stepIdx].estMs) / total;

  // rich prompts open with the trigger word — the human label is what follows
  const promptLabel = (prompt || "").replace(/^legoarch,?\s*/i, "").split(",")[0];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
          stage {meta.ord} of 3 · {meta.title}
        </p>
        <p className="min-w-0 max-w-full truncate text-micro text-on-dark-muted" title={prompt}>
          {promptLabel ? `“${promptLabel}” · ` : ""}usually takes {totalHint}
        </p>
      </div>

      {/* the announcement lives OUTSIDE the animated swap — AnimatePresence
          re-mounting headline+sub inside a live region queues confusing
          double announcements; screen readers get just the headline */}
      <p className="sr-only" aria-live="polite">{step.headline}</p>
      <div className="mt-2 min-h-[58px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: DUR.mod, ease: EASE.standard }}
          >
            <h2 className="font-display text-2xl font-black leading-tight text-on-dark">{step.headline}</h2>
            {step.sub && <p className="mt-0.5 text-sm text-on-dark-muted">{step.sub}</p>}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* the single progress system: one bar, stud ticks at step boundaries */}
      <div className="relative mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          {!reduced && (
            <div
              className="h-full rounded-full bg-brand-yellow/80 transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(fillFrac * 100)}%` }}
            />
          )}
        </div>
        {ticks.map((t, i) => (
          <div
            key={t.id}
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
              i < stepIdx && "bg-brand-yellow",
              i === stepIdx && (reduced ? "bg-brand-yellow" : "animate-studpop bg-brand-yellow"),
              i > stepIdx && "bg-white/15"
            )}
            style={{ left: `${Math.max(t.left * 100, 0.5)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ---- the quiet fact line (room 1's only secondary voice) -------------------

// One rotating line of text under the square — no card chrome, no controls.
// The 35s image wait supports a glance, not a reading session.
function FactLine({ deck, reduced }) {
  const lines = useMemo(
    () =>
      deck
        .filter((c) => c.kind !== "anatomy") // the square IS the anatomy
        .map((c) => `${c.title} — ${c.hook || ""}`),
    [deck]
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced || lines.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), 9000);
    return () => clearInterval(t);
  }, [reduced, lines.length]);
  if (!lines.length) return null;
  return (
    <div className="min-h-[24px] w-full max-w-[560px]">
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.mod, ease: EASE.standard }}
          className="text-center text-sm text-on-dark-muted"
        >
          {lines[i % lines.length]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---- the stage ------------------------------------------------------------

// `solo` (room 1): centered single column — square + fact line, no card hand.
// Default (room 2): square left; card hand + `aside` (call sheet) right —
// both columns sized so the whole room fits the viewport without scrolling.
export default function LoadingStage({ stage, prompt, params, square, aside, onStop, solo = false }) {
  const reduced = useReducedMotion();
  const deck = useMemo(() => eduCards({ stage, prompt, params }), [stage, prompt, params]);

  return (
    // pb clears the app's fixed footer credit line
    <div className="w-full pb-10">
      <Marquee key={stage} track={stage} prompt={prompt} reduced={reduced} />

      <div
        className={cn(
          "mt-6",
          solo
            ? "flex flex-col items-center gap-5"
            : "grid grid-cols-1 items-start justify-items-center gap-8 md:grid-cols-[minmax(0,620px)_minmax(0,1fr)] md:items-center md:justify-items-start"
        )}
      >
        {/* the square is the monument — everything else is subordinate
            (solo adds a fact line below, so its square gives up a little) */}
        <div className="w-full" style={{ maxWidth: solo ? "min(54vh, 600px)" : "min(56vh, 620px)" }}>
          <div className="relative w-full overflow-hidden rounded-xl bg-elevated shadow-pop">
            <div className="aspect-square w-full" />
            {square}
          </div>
        </div>

        {solo ? (
          <FactLine deck={deck} reduced={reduced} />
        ) : (
          <div className="flex w-full max-w-[440px] flex-col">
            <CardHand deck={deck} reduced={reduced} />
            {aside}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center">
        <Button variant="secondary" onClick={onStop}>
          <X size={15} /> Stop waiting
        </Button>
        <p className="mt-1.5 text-xs text-on-dark-muted">
          Stops the wait here — the job may keep running on the server.
        </p>
      </div>
    </div>
  );
}
