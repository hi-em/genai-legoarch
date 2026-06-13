// The walkable collector's room — and the single 3D stage for everything. In
// free-walk you stroll (FpsControls) and open shelved sets with E. A freshly
// forged set arrives in "staging": it packs on a central plinth, you inspect it
// (3D booklet / pieces & prices / downloads), then "Add to shelf" slides it to
// its slot. The camera is owned by FpsControls in free-walk and by CameraRig in
// every other mode (FpsControls is unmounted then — exactly one camera writer).
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { normalizeAdapted } from "../lib/brickModel.js";
import { BOX } from "../lib/boxTexture.js";
import PricedSet from "../hero/trophies/PricedSet.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import RoomShell from "./RoomShell.jsx";
import PedestalSet from "./PedestalSet.jsx";
import Whiteboard from "./Whiteboard.jsx";
import FpsControls from "./FpsControls.jsx";
import CameraRig from "./CameraRig.jsx";
import FocusStage from "./FocusStage.jsx";
import InRoomInspect from "./InRoomInspect.jsx";
import Book3D from "../booklet/Book3D.jsx";
import { useRoomStage } from "./useRoomStage.js";
import {
  roomDims, pedestalSlots, noGoZones, spawnPos, OPEN_RANGE, EYE_Y,
  PLINTH_H, BOX_DISPLAY_SCALE, STAGING_PLINTH_POS, bookPos,
} from "./roomLayout.js";

const BOX_TOP = PLINTH_H + BOX.BH * BOX_DISPLAY_SCALE + 0.8;

// nearest-set targeting + E-to-open, only mounted in free-walk
function Interactions({ items, slots, onOpen, setAimed }) {
  const camera = useThree((s) => s.camera);
  const near = useRef(null);
  useFrame(() => {
    let best = null, bestI = -1, bestD = OPEN_RANGE;
    for (let i = 0; i < items.length; i++) {
      const s = slots[i];
      if (!s) continue;
      const d = Math.hypot(camera.position.x - s.pos[0], camera.position.z - s.pos[2]);
      if (d < bestD) { bestD = d; best = items[i]; bestI = i; }
    }
    const id = best?.id || null;
    if (id !== (near.current?.id || null)) { near.current = best ? { id, item: best, idx: bestI } : null; setAimed(id); }
  });
  useEffect(() => {
    const onKey = (e) => { if (e.code === "KeyE" && near.current) onOpen(near.current.item, near.current.idx); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
  return null;
}

// On entering free-walk, drop the camera to standing height at a valid spot
// (keeps x/z, fixes the focus-pose height) before FpsControls takes over.
function FreeWalkEntry({ dims }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.y = EYE_Y;
    const b = { x: dims.width / 2 - 0.6, z: dims.depth / 2 - 0.6 };
    camera.position.x = Math.max(-b.x, Math.min(b.x, camera.position.x));
    camera.position.z = Math.max(-b.z, Math.min(b.z, camera.position.z));
    // level pitch/roll (keep yaw) so an inherited look-up from a focus pose
    // doesn't carry into walking; PointerLockControls seeds from this.
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    e.x = 0; e.z = 0;
    camera.quaternion.setFromEuler(e);
  }, [camera, dims]);
  return null;
}

export default function Room({ mode: control = "fps", items, onUseList }) {
  const reduced = useReducedMotion();
  const dims = useMemo(() => roomDims(items.length), [items.length]);
  const slots = useMemo(() => pedestalSlots(items.length, dims), [items.length, dims]);
  const noGo = useMemo(() => noGoZones(slots), [slots]);
  const [aimedId, setAimedId] = useState(null);
  const [locked, setLocked] = useState(false);

  const mode = useRoomStage((s) => s.mode);
  const staged = useRoomStage((s) => s.staged);
  const focus = useRoomStage((s) => s.focus);
  const panel = useRoomStage((s) => s.panel);
  const focusWallSet = useRoomStage((s) => s.focusWallSet);
  const beginShelving = useRoomStage((s) => s.beginShelving);
  const closeInspect = useRoomStage((s) => s.closeInspect);
  const releaseToFreeWalk = useRoomStage((s) => s.releaseToFreeWalk);

  const freeWalk = mode === "free-walk";
  const focusItem = focus?.item || staged?.item;

  // Esc: leave a panel, else leave focus — but the booklet owns Esc itself.
  useEffect(() => {
    if (panel === "booklet") return;
    const onKey = (e) => {
      if (e.code !== "Escape") return;
      if (panel) closeInspect();
      else if (!freeWalk) releaseToFreeWalk();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, freeWalk, closeInspect, releaseToFreeWalk]);

  // where the active box sits (for the options-menu anchor)
  const anchor = useMemo(() => {
    if (staged) return [STAGING_PLINTH_POS[0], BOX_TOP, STAGING_PLINTH_POS[2]];
    if (focus?.origin === "wall" && slots[focus.slotIdx]) {
      const [x, , z] = slots[focus.slotIdx].pos;
      return [x, BOX_TOP, z];
    }
    return [0, BOX_TOP, 0];
  }, [staged, focus, slots]);

  const hideBox = (i) =>
    (staged && i === 0) || (focus?.origin === "wall" && i === focus.slotIdx && !freeWalk);

  const showInspect = mode === "staged-idle" || (mode === "inspecting" && panel === null);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border-dark bg-table-deep">
      <ul aria-label="Saved sets" className="sr-only">
        {items.map((it, i) => (
          <li key={it.id}>
            <button type="button" onClick={() => focusWallSet(it, i)}
              className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded focus:bg-elevated focus:px-3 focus:py-1.5 focus:text-sm focus:text-ink">
              Open {it.title || "Untitled set"}{it.setNumber ? `, set ${it.setNumber}` : ""}
            </button>
          </li>
        ))}
      </ul>

      <Canvas
        aria-hidden="true"
        shadows
        dpr={[1, 1.75]}
        frameloop="always"
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ position: spawnPos(dims), fov: 70, near: 0.05, far: 240 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); releaseToFreeWalk(); onUseList?.(); });
        }}
      >
        <RoomShell dims={dims} />
        {items.map((it, i) =>
          slots[i] ? (
            <PedestalSet key={it.id} item={it} slot={slots[i]} idx={i} aimed={aimedId === it.id} reduced={reduced} hideBox={hideBox(i)} onOpen={focusWallSet} />
          ) : null
        )}
        <Whiteboard dims={dims} />

        <CameraRig slots={slots} dims={dims} />
        {(staged || focus) && <FocusStage slots={slots} />}
        {showInspect && focusItem && (
          <ErrorBoundary silent>
            <InRoomInspect
              item={focusItem}
              bm={normalizeAdapted(focusItem.brickModel)}
              origin={staged ? "staging" : "wall"}
              anchor={anchor}
              onShelve={() => beginShelving({ to: slots[0].pos, yaw: slots[0].yaw })}
              onClose={releaseToFreeWalk}
            />
          </ErrorBoundary>
        )}
        {panel === "booklet" && focusItem && (
          <ErrorBoundary silent>
            <Book3D
              brickModel={normalizeAdapted(focusItem.brickModel)}
              setCopy={focusItem.setCopy}
              imageUrl={focusItem.renderThumb}
              position={bookPos(dims)}
              onClose={closeInspect}
            />
          </ErrorBoundary>
        )}

        {control === "fps" && freeWalk ? (
          <>
            <FreeWalkEntry dims={dims} />
            <FpsControls dims={dims} noGo={noGo} onLockChange={setLocked} />
            <Interactions items={items} slots={slots} onOpen={focusWallSet} setAimed={setAimedId} />
          </>
        ) : control === "orbit" && freeWalk ? (
          <OrbitControls makeDefault target={[0, EYE_Y, 0]} enablePan={false} minDistance={3} maxDistance={dims.depth} maxPolarAngle={Math.PI / 2 - 0.05} />
        ) : null}
      </Canvas>

      {control === "fps" && freeWalk && locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 ring-2 ring-black/30" />
      )}

      {/* pieces & prices as a screen-space panel (data-heavy → not 3D-anchored) */}
      {panel === "priced" && focusItem && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-5" onClick={closeInspect}>
          <div className="max-h-[88%] w-[min(96vw,760px)] overflow-y-auto rounded-2xl bg-elevated p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-ink">Pieces & prices</h3>
              <button onClick={closeInspect} className="rounded-full bg-sunken px-3 py-1 text-sm font-semibold text-ink hover:brightness-95">Back to the box</button>
            </div>
            <ErrorBoundary silent>
              <PricedSet brickModel={normalizeAdapted(focusItem.brickModel)} setCopy={focusItem.setCopy} />
            </ErrorBoundary>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/55 px-4 py-1.5 text-xs text-on-dark">
        {!freeWalk
          ? (panel === "booklet" ? "Flip the pages · Esc to close" : "Esc to step back")
          : control === "fps"
            ? (locked ? "WASD to move · look with the mouse · E to open · Esc to release" : "Click to look around · WASD to move · walk up to a set and press E")
            : "Drag to look around · tap a set to open"}
      </div>

      {!freeWalk && (
        <button onClick={releaseToFreeWalk} className="absolute left-3 top-3 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95">
          Back to the room
        </button>
      )}
      <button onClick={() => { releaseToFreeWalk(); onUseList?.(); }} className="absolute right-3 top-3 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95">
        List view
      </button>
    </div>
  );
}
