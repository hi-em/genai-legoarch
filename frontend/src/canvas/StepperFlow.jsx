import { useEffect, useRef } from "react";
import { Lock, Volume2, VolumeX } from "lucide-react";
import { useCanvas, useUI, useBuild, canEnter, progressOf } from "../state/store.js";
import { ZONES, BUILD_ZONES } from "./zones.js";
import { MOCK } from "../api.js";
import ZoneBody from "./ZoneBody.jsx";
import Brand from "../components/Brand.jsx";
import { Stepper, IconButton, Tooltip, Badge } from "../components/ui/index.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";

// Mobile / small-viewport fallback: the same zone bodies stacked as a vertical
// guided stepper. Same canEnter/progress gating; next()/focus() scroll instead
// of zoom (the world's pan/zoom api is absent here).
export default function StepperFlow() {
  const focusedZone = useCanvas((s) => s.focusedZone);
  const focus = useCanvas((s) => s.focus);
  const muted = useUI((s) => s.muted);
  const toggleMute = useUI((s) => s.toggleMute);
  useBuild((s) => s.brickModel);
  useBuild((s) => s.glbUrl);
  const reduced = useReducedMotion();
  const refs = useRef({});

  useEffect(() => {
    if (focusedZone && refs.current[focusedZone]) {
      refs.current[focusedZone].scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }
  }, [focusedZone, reduced]);

  const steps = BUILD_ZONES.map((z) => ({ id: z.id, label: z.short }));

  return (
    <div className="min-h-full felt">
      <header className="sticky top-0 z-40 flex items-center gap-3 h-16 px-4 bg-gradient-to-b from-stone-600 to-stone-700 shadow-[0_4px_0_#3a3d3a]">
        <Brand onClick={() => focus("generate")} />
        <div className="ml-auto flex items-center gap-2">
          <Tooltip content={muted ? "Unmute" : "Mute"}>
            <IconButton variant="solid" aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
              {muted ? <VolumeX /> : <Volume2 />}
            </IconButton>
          </Tooltip>
          {MOCK && <Badge variant="mode">MOCK</Badge>}
        </div>
      </header>

      <div className="sticky top-16 z-30 overflow-x-auto bg-stone-700/95 px-4 py-2 backdrop-blur">
        <Stepper steps={steps} statusOf={progressOf} onJump={focus} tone="dark" />
      </div>

      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-4">
        {ZONES.map((z) => {
          const unlocked = canEnter(z.id);
          return (
            <section
              key={z.id}
              ref={(el) => { refs.current[z.id] = el; }}
              className="scroll-mt-32 h-[82vh]"
            >
              {unlocked ? (
                <div className="h-full overflow-hidden rounded-lg bg-surface shadow-plate-flat ring-1 ring-black/5">
                  <ZoneBody id={z.id} active />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-stone-50/60 p-8 text-center text-muted">
                  <Lock className="h-6 w-6 opacity-50" />
                  <p className="font-display font-extrabold text-ink">{z.label} is locked</p>
                  <p className="text-sm">Generate a building first to unlock this step.</p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
