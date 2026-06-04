import { cn } from "../../lib/cn.js";

// The one signature "stud" moment per zone: an optional numbered brick badge
// plus a small uppercase label above the title.
export default function Eyebrow({ step, label, icon: Icon, className }) {
  return (
    <div className={cn("mb-3 inline-flex items-center gap-2", className)}>
      {step != null && (
        <span className="grid h-7 w-7 place-items-center rounded-stud bg-brand-yellow text-ink font-display text-sm font-black shadow-brick">
          {step}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 text-caption font-display font-extrabold uppercase tracking-[1.5px] text-muted [&_svg]:h-3.5 [&_svg]:w-3.5">
        {Icon && <Icon />}
        {label}
      </span>
    </div>
  );
}
