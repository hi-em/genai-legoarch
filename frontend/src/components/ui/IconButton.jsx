import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";
import { SPRING } from "../../lib/motion.js";

const iconButton = cva(
  "relative grid place-items-center rounded-lg cursor-pointer transition-[filter] duration-fast focus-visible:shadow-focus disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        solid: "bg-on-dark text-stone-700 shadow-brick hover:brightness-105",
        ghost: "bg-transparent text-ink hover:bg-sunken",
        accent: "bg-brand-yellow text-ink shadow-brick hover:brightness-105",
      },
      size: { sm: "w-9 h-9 [&_svg]:w-4 [&_svg]:h-4", md: "w-10 h-10 [&_svg]:w-[18px] [&_svg]:h-[18px]" },
    },
    defaultVariants: { variant: "solid", size: "md" },
  }
);

const IconButton = forwardRef(function IconButton(
  { className, variant, size, disabled, children, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : { y: 2 }}
      transition={SPRING.snap}
      className={cn(iconButton({ variant, size }), className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export default IconButton;
