// The layered loading experience: a step-aware stage tracker (what the
// pipeline is doing RIGHT NOW, honest pseudo-progress that parks at 90%) over
// a rotating deck of educational cards, plus a tiny brick conveyor for joy.
// Backend calls are synchronous awaits with no progress events, so pacing is
// time-based per stage (SSE is the upgrade path); the two REAL signals we get
// — the render arriving, the model arriving — flip the stage from outside.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STAGE_TRACKS, STAGE_META, eduCards } from "./loadingContent.js";
import { TONE } from "../lib/promptGrammar.js";
import { DUR, EASE, SPRING } from "../lib/motion.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { cn } from "../lib/cn.js";

const CARD_MS = 9000;       // auto-rotate cadence
const PAUSE_MS = 30000;     // pause after manual browsing

// ---- stage tracker -------------------------------------------------------------

// Walk the est-timeline of a track; each step's bar eases to 90% then parks.
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
    if (reduced) return;            // reduced motion: static stud row, no timers
    const steps = STAGE_TRACKS[track].steps;
    const timer = setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      let acc = 0, idx = steps.length - 1, p = 0.9;
      for (let i = 0; i < steps.length; i++) {
        if (elapsed < acc + steps[i].estMs) {
          idx = i;
          p = (elapsed - acc) / steps[i].estMs;
          break;
        }
        acc += steps[i].estMs;
      }
      setStepIdx(idx);
      // ease toward 90% and PARK — only the real await finishing moves us on
      setStepP(Math.min(0.9, p));
    }, 250);
    return () => clearInterval(timer);
  }, [track, reduced]);

  return { stepIdx, stepP };
}

function StageTracker({ track, reduced }) {
  const { steps, totalHint } = STAGE_TRACKS[track];
  const { stepIdx, stepP } = useStageProgress(track, reduced);
  const step = steps[stepIdx];
  const meta = STAGE_META[track];

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-yellow">
        stage {meta.ord} of 3 · {meta.title}
      </p>
      {/* stud-row progress: done = solid yellow, current pulses, next = faint */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "h-3 w-3 rounded-full transition-colors",
              i < stepIdx && "bg-brand-yellow",
              i === stepIdx && "animate-studpop bg-brand-yellow",
              i > stepIdx && "bg-white/15"
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: DUR.mod, ease: EASE.standard }}
          className="mt-3"
        >
          <h3 className="font-display text-xl font-extrabold text-on-dark">{step.headline}</h3>
          {step.sub && <p className="mt-1 text-sm text-on-dark-muted">{step.sub}</p>}
        </motion.div>
      </AnimatePresence>

      {!reduced && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand-yellow/80 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(stepP * 100)}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-micro text-on-dark-muted/80">
        Usually takes {totalHint}.
      </p>
    </div>
  );
}

// ---- educational carousel --------------------------------------------------------

function CardBody({ card }) {
  if (card.kind === "anatomy") {
    return (
      <div className="space-y-2">
        {card.segs.map((s, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cn("max-w-full truncate rounded-full px-2 py-0.5 text-micro font-bold", TONE[s.tone])}>
              {s.chip}
            </span>
            <span className="text-micro leading-snug text-muted">{s.why}</span>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-[13px] leading-relaxed text-ink-soft">{card.body}</p>;
}

function EduCarousel({ deck, reduced }) {
  const [idx, setIdx] = useState(0);
  const pausedUntil = useRef(0);

  // per-stage decks differ in length — restart when the deck swaps
  useEffect(() => setIdx(0), [deck]);

  useEffect(() => {
    const t = setInterval(() => {
      if (performance.now() < pausedUntil.current) return;
      setIdx((i) => (i + 1) % deck.length);
    }, CARD_MS);
    return () => clearInterval(t);
  }, [deck.length]);

  const browse = (dir) => {
    pausedUntil.current = performance.now() + PAUSE_MS;
    setIdx((i) => (i + dir + deck.length) % deck.length);
  };

  const card = deck[idx % deck.length]; // safe during a deck swap, pre-reset
  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={reduced ? { duration: 0.15 } : { type: "spring", ...SPRING.soft }}
          className="min-h-[150px] rounded-2xl bg-elevated p-4 shadow-plate-flat"
        >
          {/* 1x2 brick accent */}
          <div className="mb-2 flex items-center gap-2">
            <svg width="22" height="13" viewBox="0 0 22 13" aria-hidden>
              <rect x="1" y="4" width="20" height="8" rx="1.5" fill="#c91a09" />
              <circle cx="6.5" cy="4" r="2.6" fill="#e0301c" />
              <circle cx="15.5" cy="4" r="2.6" fill="#e0301c" />
            </svg>
            <p className="text-nano font-bold uppercase tracking-widest text-muted">
              {card.kind === "anatomy" ? "your prompt, decoded" :
               card.kind === "dial" ? "your dials" :
               card.kind === "pipeline" ? "under the hood" : "brick science"}
            </p>
          </div>
          <h4 className="font-display text-sm font-extrabold text-ink">{card.title}</h4>
          <div className="mt-1.5">
            <CardBody card={card} />
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1">
          {deck.slice(0, 12).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                (idx % 12) === i ? "bg-brand-yellow" : "bg-white/20"
              )}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => browse(-1)} aria-label="Previous card"
            className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-on-dark hover:bg-white/20">
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => browse(1)} aria-label="Next card"
            className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-on-dark hover:bg-white/20">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- the conveyor (pure delight, CSS only) ---------------------------------------

function Conveyor() {
  const bricks = [
    { c: "#c91a09", delay: "0s" },
    { c: "#f6c700", delay: "0.45s" },
    { c: "#1e5aa8", delay: "0.9s" },
  ];
  return (
    <div className="flex h-6 items-end gap-2 overflow-hidden" aria-hidden>
      {bricks.map((b, i) => (
        <div
          key={i}
          className="animate-studpop h-3.5 w-6 rounded-[2px]"
          style={{ background: b.c, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}

// ---- main ------------------------------------------------------------------------

export default function LoadingTheater({ stage, prompt, params }) {
  const reduced = useReducedMotion();
  const deck = useMemo(() => eduCards({ stage, prompt, params }), [stage, prompt, params]);

  return (
    <div className="flex w-full flex-col gap-5">
      <StageTracker track={stage} reduced={reduced} />
      <EduCarousel deck={deck} reduced={reduced} />
      {!reduced && <Conveyor />}
    </div>
  );
}
