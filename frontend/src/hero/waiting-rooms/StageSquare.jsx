// Per-stage treatments for the waiting-room square, so the three rooms read
// as a progression instead of the same static render three times:
//   image  → VisualizingCanvas (grammar skeleton — separate file)
//   mesh   → MeshStudy: the render being *studied* (ken-burns + scan + loupe)
//   bricks → VoxelSweep: the render being *sliced* (stud grid + sweep band)
// All children of the LoadingStage square wrapper, which owns aspect-square,
// rounding and overflow clipping — these fill `absolute inset-0`.
import Loupe from "./Loupe.jsx";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import { cn } from "../../lib/cn.js";
import { STUD_PITCH } from "./studGrid.js";

function Caption({ children }) {
  // bg-black/60 + white/95: ≥4.5:1 even over a pure-white render area
  return (
    <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-nano text-white/95">
      {children}
    </p>
  );
}

// (the old yellow "scan line" read as a render artifact on light images —
// the slow ken-burns + the loupe carry the "being studied" feel on their own)
export function MeshStudy({ imageUrl }) {
  const reduced = useReducedMotion();
  return (
    <div className="absolute inset-0">
      <img
        src={imageUrl}
        alt="legoarch render being reconstructed in 3D"
        className={cn("absolute inset-0 h-full w-full object-cover", !reduced && "animate-kenburns")}
      />
      <Loupe imageUrl={imageUrl} />
      <Caption>TRELLIS is studying this photo — hover to inspect</Caption>
    </div>
  );
}

// `fast` = the solver-sprint variant: quicker sweep, no caption (the
// sprint's ticker narrates instead).
export function VoxelSweep({ imageUrl, fast = false }) {
  const reduced = useReducedMotion();
  return (
    <div className="absolute inset-0">
      <img
        src={imageUrl}
        alt="legoarch render being sliced into voxels"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: `${STUD_PITCH}px ${STUD_PITCH}px`,
          opacity: 0.14,
        }}
      />
      {!reduced && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div
            className="h-full w-full animate-sweep"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent 38%, rgba(246,199,0,.2) 50%, transparent 62%)",
              ...(fast ? { animationDuration: "1.4s" } : null),
            }}
          />
        </div>
      )}
      {!fast && <Caption>slicing into plate-height voxels — 8 mm × 3.2 mm</Caption>}
    </div>
  );
}
