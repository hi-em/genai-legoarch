import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const base =
  "w-full rounded border-2 border-border bg-elevated text-body text-ink placeholder:text-muted-faint px-3 py-2.5 transition-[border-color,box-shadow] outline-none focus:border-brand-blue focus-visible:shadow-focus";

const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(base, invalid && "border-warn-fg", className)}
      {...props}
    />
  );
});

export default Input;
