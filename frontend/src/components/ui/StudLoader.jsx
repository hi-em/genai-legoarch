import { cn } from "../../lib/cn.js";

// Three brick studs popping in sequence — the canonical "working…" indicator.
// Inherits the surrounding text color via bg-current (white on a CTA, ink elsewhere).
export default function StudLoader({ className }) {
  return (
    <span className={cn("inline-flex items-end gap-1", className)} aria-hidden="true">
      <i className="block w-1.5 h-1.5 rounded-stud bg-current animate-studpop" />
      <i className="block w-1.5 h-1.5 rounded-stud bg-current animate-studpop [animation-delay:.15s]" />
      <i className="block w-1.5 h-1.5 rounded-stud bg-current animate-studpop [animation-delay:.3s]" />
    </span>
  );
}
