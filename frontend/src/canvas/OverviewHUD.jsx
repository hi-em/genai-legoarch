import { LibraryBig, Shapes, Volume2, VolumeX, Minimize2, Maximize2 } from "lucide-react";
import { useCanvas, useUI, useBuild, progressOf } from "../state/store.js";
import { BUILD_ZONES } from "./zones.js";
import { MOCK } from "../api.js";
import Brand from "../components/Brand.jsx";
import { Stepper, Chip, Button, IconButton, Badge, Tooltip } from "../components/ui/index.js";

// Persistent top bar over the world: brand (-> overview), the build stepper,
// side destinations, the overview toggle, and the mute control.
export default function OverviewHUD() {
  const focus = useCanvas((s) => s.focus);
  const overview = useCanvas((s) => s.overview);
  const focusedZone = useCanvas((s) => s.focusedZone);
  const muted = useUI((s) => s.muted);
  const toggleMute = useUI((s) => s.toggleMute);
  useBuild((s) => s.brickModel);
  useBuild((s) => s.glbUrl);

  const steps = BUILD_ZONES.map((z) => ({ id: z.id, label: z.short }));

  return (
    <header className="absolute inset-x-0 top-0 z-40 flex items-center gap-3 h-[72px] px-4 bg-gradient-to-b from-stone-600 to-stone-700 shadow-[0_4px_0_#3a3d3a,0_10px_18px_rgba(0,0,0,.18)]">
      <Brand onClick={overview} />

      <div className="hidden md:flex items-center ml-1">
        <Stepper steps={steps} statusOf={progressOf} onJump={focus} tone="dark" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Chip
          variant={focusedZone === "shelf" ? "selected" : "suggest"}
          onClick={() => focus("shelf")}
          className="hidden sm:inline-flex"
        >
          <LibraryBig className="w-4 h-4" /> Shelf
        </Chip>
        <Chip
          variant={focusedZone === "playground" ? "selected" : "suggest"}
          onClick={() => focus("playground")}
          className="hidden sm:inline-flex"
        >
          <Shapes className="w-4 h-4" /> Playground
        </Chip>

        <Button variant="nav" size="sm" onClick={overview} className="gap-1.5">
          {focusedZone ? <Minimize2 /> : <Maximize2 />}
          <span className="hidden sm:inline">Overview</span>
        </Button>

        <Tooltip content={muted ? "Unmute" : "Mute"}>
          <IconButton
            variant="solid"
            aria-pressed={muted}
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={toggleMute}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </IconButton>
        </Tooltip>

        {MOCK && <Badge variant="mode" className="hidden md:inline-flex">MOCK</Badge>}
      </div>
    </header>
  );
}
