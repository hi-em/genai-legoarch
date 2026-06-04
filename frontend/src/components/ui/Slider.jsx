import * as RSlider from "@radix-ui/react-slider";
import { cn } from "../../lib/cn.js";

// Thin wrapper over Radix Slider. `value`/`onValueChange` use arrays, e.g. [3].
export default function Slider({ className, ...props }) {
  return (
    <RSlider.Root
      className={cn("relative flex items-center select-none touch-none w-full h-5", className)}
      {...props}
    >
      <RSlider.Track className="relative grow rounded-pill bg-stone-300 h-1.5">
        <RSlider.Range className="absolute h-full rounded-pill bg-brand-red" />
      </RSlider.Track>
      <RSlider.Thumb
        className="block w-5 h-5 rounded-stud bg-elevated border border-border shadow-brick outline-none cursor-grab active:cursor-grabbing focus-visible:shadow-focus transition-transform hover:scale-105"
        aria-label="value"
      />
    </RSlider.Root>
  );
}
