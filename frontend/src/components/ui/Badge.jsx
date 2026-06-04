import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const badge = cva(
  "inline-flex items-center rounded text-caption font-display font-extrabold tracking-[1.5px] px-2 py-1",
  {
    variants: {
      variant: {
        mode: "bg-ink text-brand-yellow",
        neutral: "bg-sunken text-ink",
        accent: "bg-brand-yellow text-ink",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export default function Badge({ className, variant, ...props }) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
