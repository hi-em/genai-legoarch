import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";
import { SPRING } from "../../lib/motion.js";

// The one chip. Every pill-shaped, tappable tag in the app routes through here
// so border-radius, padding, type scale, and the selected / hover / disabled
// states stay in lockstep. Pick a `variant` for intent and a `size` for density:
//   variant: suggest   — unselected, tap to choose (call sheet, examples, filters)
//            selected   — the active choice (radio / toggle on-state)
//            removable  — a committed value you can clear (hover → red)
//   size:    md (default) — text-sm, roomy  ·  sm — text-micro, dense rows
// State props (aria-pressed / aria-checked / role / disabled) pass straight
// through, so the same component serves buttons, radios, and toggles.
const chip = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-pill border-2 font-semibold cursor-pointer select-none transition-colors focus-visible:shadow-focus outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        suggest: "border-stone-300 bg-white text-stone-500 hover:border-brand-blue hover:text-brand-blue",
        // NB: `bg-brand-blue/10` compiles to NOTHING — Tailwind can't apply an
        // opacity modifier to a bare `var(--brand-blue)` (no <alpha-value>
        // channel). Use color-mix so the light-blue fill actually renders, and
        // mix toward white (not transparent) so it reads the same on the dark
        // call-sheet panel and on light surfaces.
        selected: "border-brand-blue bg-[color-mix(in_srgb,var(--brand-blue)_10%,white)] text-brand-blue",
        removable: "border-stone-300 bg-white text-stone-500 hover:border-brand-red hover:text-brand-red",
      },
      size: {
        sm: "px-2.5 py-0.5 text-micro",
        md: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { variant: "suggest", size: "md" },
  }
);

const Chip = forwardRef(function Chip({ className, variant, size, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ y: 1 }}
      transition={SPRING.snap}
      className={cn(chip({ variant, size }), className)}
      {...props}
    />
  );
});

export default Chip;
