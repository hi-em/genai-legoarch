import { WORDMARK } from "./brand.js";
import { cn } from "../../lib/cn.js";

const COLOR_CLASS = {
  yellow: "text-brand-yellow",
  red: "text-brand-red",
  blue: "text-brand-blue",
};

// The lEgoarCh wordmark as DOM spans. Size + base color come from className
// (e.g. "text-lg text-on-dark"); the colored letters use the brand tokens.
// `perChar` splits multi-letter segments into one span per character with
// data-ch indices (0..7) so the launch intro can measure per-letter rects —
// metrics are identical either way (letter-spacing applies per glyph).
// flattened once — keys and data-ch indices derive from the static structure
const CHARS = WORDMARK.flatMap((seg, i) =>
  seg.t.split("").map((ch, j) => ({ ch, c: seg.c, key: `${i}-${j}` }))
);

export default function Wordmark({ className, perChar = false }) {
  return (
    <span className={cn("font-display font-extrabold tracking-tight", className)}>
      {perChar
        ? CHARS.map((c, k) => (
            <span key={c.key} data-ch={k} className={c.c ? COLOR_CLASS[c.c] : undefined}>
              {c.ch}
            </span>
          ))
        : WORDMARK.map((seg, i) =>
            seg.c ? (
              <span key={i} className={COLOR_CLASS[seg.c]}>{seg.t}</span>
            ) : (
              <span key={i}>{seg.t}</span>
            )
          )}
    </span>
  );
}
