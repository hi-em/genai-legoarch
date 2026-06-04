import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";
import { SPRING } from "../../lib/motion.js";

const chip = cva(
  "inline-flex items-center gap-1.5 rounded-pill border-2 px-3 py-1 text-sm font-semibold cursor-pointer select-none transition-colors focus-visible:shadow-focus outline-none",
  {
    variants: {
      variant: {
        suggest: "border-stone-400 text-stone-500 bg-white hover:border-brand-blue hover:text-brand-blue",
        selected: "border-brand-blue text-brand-blue bg-white",
        removable: "border-stone-400 text-stone-500 bg-white",
      },
    },
    defaultVariants: { variant: "suggest" },
  }
);

const Chip = forwardRef(function Chip({ className, variant, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ y: 1 }}
      transition={SPRING.snap}
      className={cn(chip({ variant }), className)}
      {...props}
    />
  );
});

export default Chip;
