// LEGO-hardware slider: a sunken groove in the plate with a stud for a thumb.
// Thin Radix wrapper so keyboard support, ARIA and touch come for free.
import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "../../lib/cn.js";

export default function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  accent = "bg-brand-yellow",
  className,
  "aria-label": ariaLabel,
}) {
  return (
    <RadixSlider.Root
      className={cn("relative flex h-5 w-full touch-none select-none items-center", className)}
      value={[value]}
      onValueChange={([v]) => onValueChange?.(v)}
      min={min}
      max={max}
      step={step}
    >
      <RadixSlider.Track className="relative h-2 grow rounded-full bg-sunken shadow-[inset_0_1px_2px_rgba(20,30,25,.18)]">
        <RadixSlider.Range className={cn("absolute h-full rounded-full", accent)} />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        aria-label={ariaLabel}
        className={cn(
          "block h-[18px] w-[18px] rounded-full bg-elevated shadow-brick",
          "border border-stone-300 transition-transform",
          "hover:scale-110 active:translate-y-px active:shadow-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
        )}
      />
    </RadixSlider.Root>
  );
}
