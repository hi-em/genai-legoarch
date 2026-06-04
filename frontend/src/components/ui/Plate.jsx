import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const plate = cva("relative bg-surface text-ink", {
  variants: {
    variant: {
      default: "rounded-lg shadow-plate-flat",
      signature: "rounded-lg shadow-plate",
      inner: "rounded-lg border border-border shadow-none",
      flush: "rounded-lg",
    },
    pad: { none: "", sm: "p-4", md: "p-6", lg: "p-8" },
  },
  defaultVariants: { variant: "default", pad: "lg" },
});

const Plate = forwardRef(function Plate({ className, variant, pad, ...props }, ref) {
  return <div ref={ref} className={cn(plate({ variant, pad }), className)} {...props} />;
});

export default Plate;
