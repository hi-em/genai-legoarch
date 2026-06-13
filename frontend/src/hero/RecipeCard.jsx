// The render-stop photo with a flip side: the full reproducibility recipe.
// Front = the FLUX render; back = seed, model line and the enhanced prompt
// decomposed into the 8 grammar slots as hover-explained chips (same parser
// + tones as the loading cards). The WHOLE card flips on click/Enter/Space —
// the corner pill is just a hint. Pure CSS 3D flip — under reduced motion
// the rotation becomes an opacity crossfade.
import { useMemo, useState } from "react";
import { FlipHorizontal } from "lucide-react";
import { parsePromptSlots, TONE } from "../lib/promptGrammar.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { cn } from "../lib/cn.js";

const DEFAULT_HINT = "Hover a chip — each one is a slot in the prompt grammar.";

export default function RecipeCard({ imageUrl, runRecord }) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(null);

  const slots = useMemo(
    () => parsePromptSlots(runRecord?.enhancedPrompt),
    [runRecord?.enhancedPrompt]
  );
  const img = runRecord?.resolved?.image || {};

  const toggle = () =>
    setFlipped((f) => {
      if (f) setHint(null);
      return !f;
    });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label="Render card — press to flip between the photo and the recipe"
      onClick={toggle}
      onKeyDown={(e) => {
        // only when the CARD itself is focused — Enter/Space on the inner
        // recipe chips/back-link bubbles up here and must not also unflip
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      className="relative aspect-square w-full cursor-pointer rounded-xl transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-pop [perspective:1200px]"
    >
      <div
        className={cn(
          "relative h-full w-full",
          !reduced && "transition-transform duration-flip [transform-style:preserve-3d]",
          !reduced && flipped && "[transform:rotateY(180deg)]"
        )}
      >
        {/* front: the photo */}
        <div
          className={cn(
            "absolute inset-0 [backface-visibility:hidden]",
            reduced && "transition-opacity duration-moderate",
            reduced && (flipped ? "pointer-events-none opacity-0" : "opacity-100")
          )}
        >
          <img
            src={imageUrl}
            alt="legoarch render"
            className="block h-full w-full rounded-xl object-cover shadow-pop"
          />
          {/* passive hint — the whole card is the button */}
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-micro font-semibold text-white">
            <FlipHorizontal size={12} /> see the recipe
          </span>
        </div>

        {/* back: the recipe — sized to FIT the square (no inner scrollbar;
            chips truncate, the hint clamps, and only a pathological prompt
            falls back to an invisible scroll) */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col rounded-xl bg-ink p-3.5 shadow-pop",
            "[backface-visibility:hidden]",
            reduced
              ? cn("transition-opacity duration-moderate", flipped ? "opacity-100" : "pointer-events-none opacity-0")
              : "[transform:rotateY(180deg)]"
          )}
        >
          <p className="text-nano font-bold uppercase tracking-widest text-on-dark-muted">
            the recipe
          </p>

          <div className="mt-1.5 space-y-0.5 font-mono text-nano text-on-dark">
            <p>
              seed <span className="text-brand-yellow">{runRecord?.seed ?? "random"}</span>
            </p>
            <p>
              FLUX.2 Klein + legoarch LoRA @ {img.lora_scale ?? 1} · {img.steps ?? 28} steps ·
              strength {img.guidance ?? 5}
            </p>
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-wrap content-start gap-1">
              {slots.map((s, i) => (
                <button
                  key={`${s.id}-${i}`}
                  onPointerEnter={() => setHint(`${s.name} — ${s.ui_hint}`)}
                  onClick={(e) => {
                    e.stopPropagation(); // inspect a chip without unflipping
                    setHint(`${s.name} — ${s.ui_hint}`);
                  }}
                  className={cn(
                    "max-w-full truncate rounded-full px-2 py-0.5 text-nano font-bold",
                    TONE[s.tone]
                  )}
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-1.5 line-clamp-2 text-nano text-on-dark-muted">{hint || DEFAULT_HINT}</p>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(false);
              setHint(null);
            }}
            className="mt-1 self-start text-nano font-semibold text-on-dark underline-offset-2 hover:underline"
          >
            ← back to the photo
          </button>
        </div>
      </div>
    </div>
  );
}
