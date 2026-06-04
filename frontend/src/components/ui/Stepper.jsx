import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { SPRING } from "../../lib/motion.js";

// Horizontal numbered progress rail for the build pipeline.
// steps: [{ id, label }]; statusOf(id) -> 'done' | 'active' | 'locked'.
// tone: 'light' (on a plate) | 'dark' (on the stone HUD).
export default function Stepper({ steps, statusOf, onJump, className, tone = "light" }) {
  const dark = tone === "dark";
  return (
    <ol className={cn("flex items-center gap-1", className)}>
      {steps.map((s, i) => {
        const status = statusOf(s.id);
        const clickable = status !== "locked" && onJump;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(s.id)}
              className={cn(
                "group inline-flex items-center gap-2 rounded-pill pl-1.5 pr-3 py-1 transition-colors outline-none focus-visible:shadow-focus",
                clickable ? "cursor-pointer" : "cursor-default",
                clickable && (dark ? "hover:bg-white/10" : "hover:bg-black/5"),
                status === "locked" && "opacity-50"
              )}
              aria-current={status === "active" ? "step" : undefined}
            >
              <motion.span
                initial={false}
                animate={{ scale: status === "active" ? 1.06 : 1 }}
                transition={SPRING.snap}
                className={cn(
                  "grid place-items-center w-7 h-7 rounded-stud text-caption font-display font-black shadow-brick",
                  status === "done" && "bg-brand-blue text-white",
                  status === "active" && "bg-brand-yellow text-ink",
                  status === "locked" && "bg-stone-300 text-stone-500 shadow-none"
                )}
              >
                {status === "done" ? <Check className="w-4 h-4" /> : status === "locked" ? <Lock className="w-3.5 h-3.5" /> : i + 1}
              </motion.span>
              <span
                className={cn(
                  "text-sm font-display font-extrabold",
                  status === "active"
                    ? dark ? "text-on-dark" : "text-ink"
                    : dark ? "text-on-dark-muted" : "text-muted"
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "w-6 h-0.5 rounded-pill transition-colors",
                  statusOf(steps[i + 1].id) === "locked" ? "bg-border" : "bg-brand-blue"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
