import { forwardRef } from "react";
import { cn } from "../../lib/cn.js";

const base =
  "w-full rounded border-2 border-border bg-elevated text-body text-ink placeholder:text-muted-faint px-3 py-2.5 min-h-24 resize-y transition-[border-color,box-shadow] outline-none focus:border-brand-blue focus-visible:shadow-focus";

const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, className)} {...props} />;
});

export default Textarea;
