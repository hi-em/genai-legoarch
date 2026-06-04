import { cn } from "../../lib/cn.js";

// Shimmering placeholder for content that is loading (render image, viewer).
export default function Skeleton({ className }) {
  return (
    <div className={cn("relative overflow-hidden rounded bg-sunken", className)} aria-hidden="true">
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </div>
  );
}
