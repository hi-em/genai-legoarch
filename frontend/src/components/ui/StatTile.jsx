import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const tile = cva("rounded p-3 text-center min-w-[96px] flex-1", {
  variants: {
    variant: {
      neutral: "bg-sunken",
      ok: "bg-ok-bg",
      warn: "bg-warn-bg",
    },
  },
  defaultVariants: { variant: "neutral" },
});

const valueColor = { neutral: "text-ink", ok: "text-ok-fg", warn: "text-warn-fg" };

// value: the headline number/string; label: small caption (icon + text via children).
export default function StatTile({ value, label, variant = "neutral", className }) {
  return (
    <div className={cn(tile({ variant }), className)}>
      <span className={cn("block font-display text-h2 font-black leading-none mb-1", valueColor[variant])}>
        {value}
      </span>
      <small className="inline-flex items-center gap-1 text-caption text-muted [&_svg]:w-3.5 [&_svg]:h-3.5">
        {label}
      </small>
    </div>
  );
}
