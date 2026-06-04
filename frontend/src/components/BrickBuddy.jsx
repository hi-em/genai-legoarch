import { useState } from "react";
import { X } from "lucide-react";
import { useUI } from "../state/store.js";

// Abstract "brick buddy" — a friendly brick with a face. Deliberately NOT a
// minifigure (trademark-protected): no head/limbs, just a 2x2 brick mascot.
const TIPS = {
  generate: "Type a building or pick an example, then hit Generate. I'll build real 3D from it!",
  viewer: "Print it as-is (Exit 1), or continue to turn it into real, buildable bricks.",
  studio: "Green badges mean it'll stand up. Grab the parts list, or add it to your shelf!",
  shelf: "Your collection lives here — it sticks around between visits. Go make more!",
  playground: "Mash two landmarks together, shuffle the colors, or restyle the massing. Go wild.",
};

function BuddyFace({ size = 52 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 64" aria-hidden="true">
      {/* studs */}
      <ellipse cx="20" cy="16" rx="7" ry="4" fill="#ffe45e" />
      <ellipse cx="36" cy="16" rx="7" ry="4" fill="#ffe45e" />
      <rect x="13" y="12" width="14" height="6" rx="3" fill="#f6c700" />
      <rect x="29" y="12" width="14" height="6" rx="3" fill="#f6c700" />
      {/* body */}
      <rect x="8" y="16" width="40" height="40" rx="6" fill="#f6c700" />
      <rect x="8" y="16" width="40" height="8" rx="6" fill="#ffd84a" />
      {/* eyes */}
      <circle cx="21" cy="34" r="6" fill="#fff" />
      <circle cx="35" cy="34" r="6" fill="#fff" />
      <circle cx="22" cy="35" r="2.6" fill="#20262b" />
      <circle cx="36" cy="35" r="2.6" fill="#20262b" />
      {/* smile */}
      <path d="M20 44 q8 7 16 0" stroke="#20262b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function BrickBuddy() {
  const tab = useUI((s) => s.tab);
  const [open, setOpen] = useState(true);

  return (
    <div className="bf-buddy">
      {open && (
        <div className="bf-bubble" role="status">
          <span>{TIPS[tab]}</span>
          <button className="bf-bubble-x" aria-label="Dismiss tip" onClick={() => setOpen(false)}><X size={14} /></button>
        </div>
      )}
      <button className="bf-buddy-fig" aria-label={open ? "Hide tips" : "Show tips"} onClick={() => setOpen((o) => !o)}>
        <BuddyFace />
      </button>
    </div>
  );
}
