// The fanned hand of educational cards for the waiting rooms — replaces the
// old single-card carousel. Top 3 cards render like held playing cards; the
// whole top card flips on click/tap (CSS 3D, same pattern as RecipeCard),
// drag/swipe or the arrows leaf to the next, and a slow auto-advance keeps
// the hand moving when idle (never while a card is flipped — don't yank a
// card someone is reading). Reduced motion or narrow screens collapse to a
// single crossfading card.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, FlipHorizontal,
  Ruler, Layers, LayoutGrid, Blocks, Box, Gauge, Wand2, Dices, Palette,
  EyeOff, Link2, Shapes, Hourglass, GraduationCap, Paintbrush, Scissors,
  ArrowRight, Workflow, Camera, Boxes, Hammer, Type, Sparkles,
} from "lucide-react";
import { TONE } from "../../lib/promptGrammar.js";
import { DIAGRAMS } from "./CardDiagrams.jsx";
import { studDotBg } from "./studGrid.js";
import { DUR, SPRING } from "../../lib/motion.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import { cn } from "../../lib/cn.js";

// card `icon` string (loadingContent.js) → lucide component
const ICONS = {
  ruler: Ruler, layers: Layers, "layout-grid": LayoutGrid, blocks: Blocks,
  box: Box, gauge: Gauge, wand: Wand2, dices: Dices, palette: Palette,
  "eye-off": EyeOff, link: Link2, shapes: Shapes, hourglass: Hourglass,
  "graduation-cap": GraduationCap, paintbrush: Paintbrush, scissors: Scissors,
  "arrow-right": ArrowRight, workflow: Workflow, camera: Camera, boxes: Boxes,
  hammer: Hammer, type: Type,
};
const KIND_FALLBACK = { pipeline: Camera, dial: Gauge, anatomy: Type, fact: Sparkles };
const iconFor = (card) => ICONS[card.icon] || KIND_FALLBACK[card.kind] || Sparkles;

// icon chip tint per card kind (brand accents at token opacities)
const KIND_TINT = {
  pipeline: "bg-brand-red/10 text-brand-red",
  dial: "bg-brand-yellow/20 text-brand-yellow-dark",
  anatomy: "bg-sunken text-ink-soft",
  fact: "bg-brand-blue/10 text-brand-blue",
};

const CARD_MS = 13000; // auto-advance cadence (slow — reading pace)
const PAUSE_MS = 30000; // pause after any manual interaction
const DRAG_X = 60; // px of drag that commits a leaf
const DRAG_V = 400; // or px/s of fling

// fan geometry per depth slot (0 = top of hand)
const FAN = [
  { rotate: 0, x: 0, y: 0, scale: 1, z: 30 },
  { rotate: 3.5, x: 14, y: 8, scale: 0.97, z: 20 },
  { rotate: -3, x: -10, y: 14, scale: 0.94, z: 10 },
];

const KICKER = {
  anatomy: "your prompt, decoded",
  dial: "your dials",
  pipeline: "under the hood",
  fact: "brick science",
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// mini-gauge for dial cards: the run's value within the dial's range, with a
// tick marking the benchmarked default — a diagram, not another sentence
function DialGauge({ gauge, dark = false }) {
  const span = gauge.max - gauge.min || 1;
  const pct = ((gauge.value - gauge.min) / span) * 100;
  const defPct = ((gauge.def - gauge.min) / span) * 100;
  return (
    <div className="mt-3 shrink-0" aria-hidden>
      <div className={cn("relative h-1.5 w-full rounded-full", dark ? "bg-white/10" : "bg-sunken")}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-yellow/70"
          style={{ width: `${pct}%` }}
        />
        <span
          className={cn(
            "absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
            dark ? "bg-white/40" : "bg-stone-400"
          )}
          style={{ left: `${defPct}%` }}
          title="benchmarked default"
        />
        <span
          className={cn(
            "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-brand-yellow shadow-plate-flat",
            dark ? "border-ink" : "border-elevated"
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className={cn("mt-1 flex justify-between text-nano", dark ? "text-on-dark-muted" : "text-muted")}>
        <span>{gauge.min}</span>
        <span>{gauge.max}</span>
      </div>
    </div>
  );
}

function AnatomyBody({ segs }) {
  // lives on the dark back — the TONE chip pairings are designed for ink
  return (
    <div className="space-y-2">
      {segs.map((s, i) => (
        <div key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("max-w-full truncate rounded-full px-2 py-0.5 text-micro font-bold", TONE[s.tone])}>
            {s.chip}
          </span>
          <span className="text-micro leading-snug text-on-dark-muted">{s.why}</span>
        </div>
      ))}
    </div>
  );
}

function FaceChrome({ children, className, dark = false }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col overflow-hidden rounded-2xl p-4",
        dark ? "bg-ink shadow-pop" : "bg-elevated shadow-plate-flat",
        className
      )}
    >
      {dark && (
        // the lEgoarCh stud-dot texture — shared pitch with the squares
        <div aria-hidden className="pointer-events-none absolute inset-0" style={studDotBg(0.05)} />
      )}
      {children}
    </div>
  );
}

function FrontFace({ card, hidden }) {
  const Icon = iconFor(card);
  return (
    <FaceChrome className={cn("[backface-visibility:hidden]", hidden && "pointer-events-none opacity-0")}>
      {/* faint watermark motif — fills the front's quiet space */}
      <Icon
        size={96}
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -right-3 text-ink opacity-[0.05]"
      />
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", KIND_TINT[card.kind] || KIND_TINT.fact)}>
          <Icon size={16} />
        </span>
        <p className="text-nano font-bold uppercase tracking-widest text-muted">{KICKER[card.kind] || KICKER.fact}</p>
      </div>
      <h4 className="font-display text-base font-extrabold leading-snug text-ink">{card.title}</h4>
      <p className="mt-1.5 text-sm text-ink-soft">{card.hook || card.body}</p>
      {card.gauge && <DialGauge gauge={card.gauge} />}
      <span className="pointer-events-none mt-auto inline-flex items-center gap-1.5 self-end rounded-full bg-sunken px-2.5 py-1 text-nano font-semibold text-muted">
        <FlipHorizontal size={11} /> flip for the why
      </span>
    </FaceChrome>
  );
}

// The back is the card's "technical side" — ink panel, stud texture, and a
// drawn diagram doing the explaining before the words do (same language as
// the RecipeCard's recipe back).
function BackFace({ card, flat, hidden }) {
  const Diagram = DIAGRAMS[card.title];
  return (
    <FaceChrome
      dark
      className={cn(
        "[backface-visibility:hidden]",
        flat ? cn("transition-opacity duration-moderate", hidden && "pointer-events-none opacity-0") : "[transform:rotateY(180deg)]"
      )}
    >
      <p className="relative text-nano font-bold uppercase tracking-widest text-brand-yellow">
        {card.title}
      </p>
      {card.kind === "anatomy" ? (
        <div className="relative mt-2 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AnatomyBody segs={card.segs} />
        </div>
      ) : (
        <>
          {card.gauge ? <DialGauge gauge={card.gauge} dark /> : Diagram ? <Diagram /> : null}
          <div className="relative mt-2 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <p className="text-sm leading-relaxed text-on-dark-muted">{card.body}</p>
          </div>
        </>
      )}
    </FaceChrome>
  );
}

export default function CardHand({ deck, reduced: reducedProp }) {
  const reducedMotion = useReducedMotion();
  const wide = useMediaQuery("(min-width: 768px)");
  const flat = (reducedProp ?? reducedMotion) || !wide; // single-card mode

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // announced ONLY on manual interaction — a 13s auto-advance that narrates
  // itself would interrupt screen-reader users for the whole wait
  const [liveMsg, setLiveMsg] = useState("");
  const pausedUntil = useRef(0);
  const flippedRef = useRef(false);
  flippedRef.current = flipped;
  const dragMoved = useRef(false);

  // per-stage decks differ — restart when the deck swaps
  useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [deck]);

  useEffect(() => {
    const t = setInterval(() => {
      if (performance.now() < pausedUntil.current) return;
      if (flippedRef.current) return; // never auto-yank a card being read
      setIdx((i) => (i + 1) % deck.length);
    }, CARD_MS);
    return () => clearInterval(t);
  }, [deck]); // the deck OBJECT — same-length stage swaps must not keep a stale closure

  const pause = () => {
    pausedUntil.current = performance.now() + PAUSE_MS;
  };
  const advance = (dir) => {
    pause();
    setFlipped(false);
    const next = (idx + dir + deck.length) % deck.length;
    setIdx(next);
    setLiveMsg(`Card ${next + 1} of ${deck.length}: ${deck[next]?.title ?? ""}`);
  };
  const flip = () => {
    pause();
    setLiveMsg(flipped ? "Card front" : "Card back — the full story");
    setFlipped((f) => !f);
  };

  const card = deck[idx % deck.length];
  if (!card) return null;

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      advance(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      advance(-1);
    }
  };

  const interactive = {
    role: "button",
    tabIndex: 0,
    "aria-pressed": flipped,
    "aria-label": `${card.title} — press to flip the card`,
    onKeyDown,
  };

  return (
    <div
      role="group"
      aria-roledescription="card deck"
      aria-label={`What's happening while you wait — card ${idx + 1} of ${deck.length}`}
      className="w-full max-w-[440px]"
    >
      {/* screen readers hear MANUAL navigation only — auto-advance is silent */}
      <p className="sr-only" aria-live="polite">{liveMsg}</p>

      {flat ? (
        /* single-card mode: reduced motion or narrow screens */
        <div className="relative h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.base }}
              className="absolute inset-0 cursor-pointer"
              onClick={flip}
              {...interactive}
            >
              <FrontFace card={card} hidden={flipped} />
              <BackFace card={card} flat hidden={!flipped} />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* the fanned hand */
        <div className="relative h-[280px]">
          <AnimatePresence initial={false}>
            {FAN.map((slot, s) => {
              const cardIdx = (idx + s) % deck.length;
              const c = deck[cardIdx];
              if (!c || (s > 0 && deck.length <= s)) return null;
              const isTop = s === 0;
              return (
                <motion.div
                  key={cardIdx}
                  initial={{ opacity: 0, x: 40, rotate: 6, scale: 0.94 }}
                  animate={{ opacity: 1, x: slot.x, y: slot.y, rotate: slot.rotate, scale: slot.scale, zIndex: slot.z }}
                  exit={{ opacity: 0, x: 140, rotate: 8, zIndex: 40, transition: { duration: DUR.mod } }}
                  transition={SPRING.soft}
                  style={{ zIndex: slot.z }}
                  className="absolute inset-0"
                  {...(isTop
                    ? {
                        drag: "x",
                        dragElastic: 0.4,
                        dragSnapToOrigin: true,
                        onDragStart: () => {
                          dragMoved.current = true;
                          pause();
                        },
                        onDragEnd: (_, info) => {
                          if (Math.abs(info.offset.x) > DRAG_X || Math.abs(info.velocity.x) > DRAG_V) {
                            advance(info.offset.x < 0 ? 1 : -1);
                          }
                          // let the click that ends the drag get suppressed first
                          setTimeout(() => (dragMoved.current = false), 0);
                        },
                      }
                    : {})}
                >
                  {isTop ? (
                    <div
                      className="h-full w-full cursor-pointer rounded-2xl transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-pop [perspective:1200px]"
                      onClick={() => {
                        if (dragMoved.current) return; // a drag, not a click
                        flip();
                      }}
                      {...interactive}
                    >
                      <div
                        className={cn(
                          "relative h-full w-full transition-transform duration-flip ease-standard [transform-style:preserve-3d]",
                          flipped && "[transform:rotateY(180deg)]"
                        )}
                      >
                        <FrontFace card={c} />
                        <BackFace card={c} />
                      </div>
                    </div>
                  ) : (
                    <div aria-hidden className="pointer-events-none h-full w-full">
                      <div className="relative h-full w-full">
                        <FrontFace card={c} />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* counter + leaf buttons */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-micro tabular-nums text-on-dark-muted">
          {idx + 1} / {deck.length}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => advance(-1)}
            aria-label="Previous card"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-on-dark shadow-plate-flat transition-colors hover:bg-white/20"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => advance(1)}
            aria-label="Next card"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-on-dark shadow-plate-flat transition-colors hover:bg-white/20"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
