import { WORDMARK } from "./brand.js";
import { cn } from "../../lib/cn.js";

const COLOR_CLASS = {
  yellow: "text-brand-yellow",
  red: "text-brand-red",
  blue: "text-brand-blue",
};

// The lEgoarCh wordmark as DOM spans. Size + base color come from className
// (e.g. "text-lg text-on-dark"); the colored letters use the brand tokens.
export default function Wordmark({ className }) {
  return (
    <span className={cn("font-display font-extrabold tracking-tight", className)}>
      {WORDMARK.map((seg, i) =>
        seg.c ? (
          <span key={i} className={COLOR_CLASS[seg.c]}>{seg.t}</span>
        ) : (
          <span key={i}>{seg.t}</span>
        )
      )}
    </span>
  );
}
