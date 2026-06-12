// The render-stop photo with a flip side: the full reproducibility recipe.
// Front = the FLUX render; back = seed, model line and the enhanced prompt
// decomposed into the 8 grammar slots as hover-explained chips (same parser
// + tones as the loading theater's anatomy card). Pure CSS 3D flip — under
// reduced motion the rotation becomes an opacity crossfade.
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

  return (
    <div className="relative aspect-square w-full [perspective:1200px]">
      <div
        className={cn(
          "relative h-full w-full",
          !reduced && "transition-transform duration-500 [transform-style:preserve-3d]",
          !reduced && flipped && "[transform:rotateY(180deg)]"
        )}
      >
        {/* front: the photo */}
        <div
          className={cn(
            "absolute inset-0 [backface-visibility:hidden]",
            reduced && "transition-opacity duration-300",
            reduced && (flipped ? "pointer-events-none opacity-0" : "opacity-100")
          )}
        >
          <img
            src={imageUrl}
            alt="legoarch render"
            className="block h-full w-full rounded-xl object-cover shadow-pop"
          />
          <button
            onClick={() => setFlipped(true)}
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-micro font-semibold text-white hover:bg-black/75"
          >
            <FlipHorizontal size={12} /> see the recipe
          </button>
        </div>

        {/* back: the recipe */}
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto rounded-xl bg-ink p-4 shadow-pop",
            "[backface-visibility:hidden]",
            reduced
              ? cn("transition-opacity duration-300", flipped ? "opacity-100" : "pointer-events-none opacity-0")
              : "[transform:rotateY(180deg)]"
          )}
        >
          <p className="text-nano font-bold uppercase tracking-widest text-on-dark-muted">
            the recipe
          </p>

          <div className="mt-2 space-y-1 font-mono text-micro text-on-dark">
            <p>
              seed <span className="text-brand-yellow">{runRecord?.seed ?? "random"}</span>
            </p>
            <p>
              FLUX.2 Klein + legoarch LoRA @ {img.lora_scale ?? 1} · {img.steps ?? 28} steps ·
              strength {img.guidance ?? 5}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {slots.map((s, i) => (
              <button
                key={`${s.id}-${i}`}
                onPointerEnter={() => setHint(`${s.name} — ${s.ui_hint}`)}
                onClick={() => setHint(`${s.name} — ${s.ui_hint}`)}
                className={cn(
                  "max-w-full truncate rounded-full px-2 py-0.5 text-micro font-bold",
                  TONE[s.tone]
                )}
              >
                {s.text}
              </button>
            ))}
          </div>

          <p className="mt-2 min-h-[34px] text-micro text-on-dark-muted">{hint || DEFAULT_HINT}</p>

          <button
            onClick={() => { setFlipped(false); setHint(null); }}
            className="mt-1 text-micro font-semibold text-on-dark underline-offset-2 hover:underline"
          >
            ← back to the photo
          </button>
        </div>
      </div>
    </div>
  );
}
