import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useBuild, derivePhase } from "../state/store.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { cn } from "../lib/cn.js";

// Abstract "brick buddy" — a friendly 2x2 brick with a face. Deliberately NOT a
// minifigure (trademark-protected).
// Tips follow the pipeline phase so the buddy never tells you to "hit
// Visualize" while a render is already running.
const TIPS = {
  intro:
    "Name a building, hit Visualize, and watch it click together — course by course — into a set you could actually build.",
  rendering:
    "FLUX is sculpting your building out of pure noise — about half a minute. Flip the cards while you wait.",
  render: "Happy with the photo? Click it to flip — the full recipe is on the back.",
  meshing:
    "This is the long one (4–6 min). Try the loupe on the render — and lock in your call sheet.",
  mesh: "Orbit the raw mesh. Brick dials are cheap — legolizing takes seconds, so experiment.",
  legolizing: "No AI in this stage — pure geometry. Done before you finish this sentence.",
  assembling: "Watch it click together, course by course.",
  reveal: "Hit Pack to seal it onto your shelf. Want changes? Tune the bricks and re-legolize — then Pack the new version.",
};

function BuddyFace({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 64" aria-hidden="true">
      <ellipse cx="20" cy="16" rx="7" ry="4" fill="#ffe45e" />
      <ellipse cx="36" cy="16" rx="7" ry="4" fill="#ffe45e" />
      <rect x="13" y="12" width="14" height="6" rx="3" fill="#f6c700" />
      <rect x="29" y="12" width="14" height="6" rx="3" fill="#f6c700" />
      <rect x="8" y="16" width="40" height="40" rx="6" fill="#f6c700" />
      <rect x="8" y="16" width="40" height="8" rx="6" fill="#ffd84a" />
      <circle cx="21" cy="34" r="6" fill="#fff" />
      <circle cx="35" cy="34" r="6" fill="#fff" />
      <circle cx="22" cy="35" r="2.6" fill="#20262b" />
      <circle cx="36" cy="35" r="2.6" fill="#20262b" />
      <path d="M20 44 q8 7 16 0" stroke="#20262b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function BrickBuddy() {
  const phase = useBuild(derivePhase);
  const [open, setOpen] = useState(true);
  const reduced = useReducedMotion();

  // a dismissal silences the CURRENT phase only — a new phase reopens the
  // bubble with its own tip
  useEffect(() => {
    setOpen(true);
  }, [phase]);

  const tip = TIPS[phase] ?? TIPS.intro;

  return (
    <div className="fixed bottom-[18px] right-[18px] z-50 hidden items-end gap-2.5 md:flex">
      {open && (
        <div className="relative max-w-[250px] rounded-[14px] bg-elevated px-3.5 py-3 pr-8 text-sm leading-snug text-ink shadow-pop" role="status">
          <span>{tip}</span>
          <button
            className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-sunken text-muted hover:text-ink"
            aria-label="Dismiss tip"
            onClick={() => setOpen(false)}
          >
            <X size={14} />
          </button>
          <span className="absolute -right-2 bottom-4 h-0 w-0 border-y-8 border-l-[9px] border-y-transparent border-l-elevated" />
        </div>
      )}
      <button
        className={cn(
          "cursor-pointer border-0 bg-transparent p-0 leading-[0] drop-shadow-[0_4px_3px_rgba(20,30,25,.3)]",
          !reduced && "animate-bob"
        )}
        aria-label={open ? "Hide tips" : "Show tips"}
        onClick={() => setOpen((o) => !o)}
      >
        <BuddyFace />
      </button>
    </div>
  );
}
