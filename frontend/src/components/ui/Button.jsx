import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn.js";
import { SPRING } from "../../lib/motion.js";
import StudLoader from "./StudLoader.jsx";

const button = cva(
  "relative inline-flex items-center justify-center gap-2 font-display font-extrabold rounded select-none cursor-pointer transition-[filter] duration-fast focus-visible:shadow-focus disabled:opacity-50 disabled:pointer-events-none active:shadow-brick-press",
  {
    variants: {
      variant: {
        primary: "bg-brand-red text-white shadow-brick hover:brightness-105",
        secondary: "bg-stone-300 text-ink shadow-brick hover:brightness-[1.03]",
        ghost: "bg-transparent text-ink hover:bg-sunken active:shadow-none",
        nav: "bg-on-dark text-stone-700 shadow-brick hover:brightness-105",
      },
      size: {
        sm: "text-sm px-3 py-1.5 [&_svg]:w-4 [&_svg]:h-4",
        md: "text-[.92rem] px-4 py-2.5 [&_svg]:w-[18px] [&_svg]:h-[18px]",
        lg: "text-base px-5 py-3 [&_svg]:w-5 [&_svg]:h-5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

const Button = forwardRef(function Button(
  { className, variant, size, loading = false, disabled, children, ...props },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { y: 2 }}
      transition={SPRING.soft}
      className={cn(button({ variant, size }), className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <StudLoader />}
      {children}
    </motion.button>
  );
});

export default Button;
