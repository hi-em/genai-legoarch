import { Handle, Position, NodeResizer } from "@xyflow/react";
import { GripHorizontal, Maximize2, Lock } from "lucide-react";
import { useCanvas, useBuild, canEnter, progressOf } from "../state/store.js";
import { ZONE_BY_ID } from "./zones.js";
import ZoneBody from "./ZoneBody.jsx";
import { cn } from "../lib/cn.js";

const DOT = { active: "bg-brand-yellow", done: "bg-brand-blue", locked: "bg-stone-400" };

// One draggable / resizable card on the canvas. Selection (click) makes the
// 3D viewer live and reveals resize handles; the top bar is the drag handle.
export default function ZoneNode({ id, selected }) {
  const z = ZONE_BY_ID[id];
  const focus = useCanvas((s) => s.focus);
  // reactive so lock / status update as the build advances
  useBuild((s) => s.brickModel);
  useBuild((s) => s.glbUrl);
  const locked = !canEnter(id);
  const status = progressOf(id);

  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-lg bg-surface transition-shadow duration-moderate",
        selected ? "shadow-pop ring-2 ring-brand-blue" : "shadow-plate-flat ring-1 ring-black/5 hover:shadow-pop hover:-translate-y-px"
      )}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={360}
        minHeight={320}
        lineClassName="!border-brand-blue/60"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-2 !border-white !bg-brand-blue"
      />

      {/* drag handle bar */}
      <div className="zone-drag flex h-8 shrink-0 cursor-grab items-center gap-2 border-b border-border bg-stone-50 px-2.5 active:cursor-grabbing">
        <GripHorizontal className="h-4 w-4 text-muted-faint" />
        <span className={cn("h-2 w-2 rounded-full", DOT[status])} />
        <span className="text-caption font-display font-extrabold uppercase tracking-[1.5px] text-muted">
          {z.short}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {locked && <Lock className="h-3.5 w-3.5 text-muted-faint" />}
          <button
            type="button"
            className="nodrag grid h-6 w-6 place-items-center rounded text-muted hover:bg-sunken hover:text-ink"
            title="Zoom to this card"
            aria-label={`Zoom to ${z.label}`}
            onClick={() => focus(id)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* screen content (fills, scrolls internally) */}
      <div className="relative min-h-0 flex-1">
        <ZoneBody id={id} active={selected} />
      </div>

      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0" isConnectable={false} />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0" isConnectable={false} />
    </div>
  );
}
