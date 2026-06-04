import { cn } from "../../lib/cn.js";

export function Table({ className, ...props }) {
  return (
    <table
      className={cn(
        "w-full border-collapse text-sm",
        "[&_th]:text-left [&_th]:font-bold [&_th]:text-muted [&_th]:py-2 [&_th]:px-2",
        "[&_td]:py-2 [&_td]:px-2 [&_td]:border-b [&_td]:border-border",
        "[&_tbody_tr:hover]:bg-sunken",
        className
      )}
      {...props}
    />
  );
}

// A real LEGO color swatch — functionally meaningful, so it stays literal.
export function Swatch({ color, className }) {
  return (
    <span
      className={cn("inline-block w-[18px] h-[18px] rounded-sm border border-black/15 align-middle", className)}
      style={{ background: color, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}
    />
  );
}
