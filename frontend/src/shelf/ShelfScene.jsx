// The Shelf — the collection as a bright, static bookcase you ORBIT around:
// one canvas, a warm-birch grid, each saved set a diorama in its own
// compartment (the retail box at the back with its painted front panel, the
// built model in front, a plaque below). Drag to orbit the camera, right-drag /
// two-finger to pan, scroll to zoom — and a Recenter button re-frames the whole
// wall if you get lost. The shelf itself never moves. Click a compartment to
// open the set, hover it for a remove control. Box + build size scale with the
// set's piece count (sizeFrac), so a flagship reads bigger than a small set.
//
// Salvaged from the (orphaned) shelf/ShelfWall.jsx: it already solved the hard
// parts — frameloop="demand" with invalidate() on every control change,
// module-singleton carton materials, instanced legacy-box geometry, refcounted
// front textures, an sr-only a11y mirror, and z-fight-safe geometry. The
// rebuild changes only three things: MapControls(pan, ortho) -> OrbitControls
// (rotate, perspective), the dark mood -> bright product-shot lighting, and a
// remove-with-confirm affordance. Idle GPU stays flat (demand frameloop, no
// per-frame mutation when you're not interacting).
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Canvas, useThree, invalidate } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import { Trash2, Crosshair } from "lucide-react";
import { ClosedCarton } from "../transition/PackingScene.jsx";
import { BrickInstances, modelOffset, worldHeight } from "../viewer/bricks3d.jsx";
import { normalizeAdapted } from "../lib/brickModel.js";
import { BOX } from "../lib/boxTexture.js";
import { useShelfBoxTexture } from "./useShelfBoxTexture.js";
import {
  COLS, CELL_W, CELL_H, CELL_D, FRAME_T, SET_TILT,
  BOX_X, BOX_Z, BOX_YAW, MODEL_X, MODEL_Z,
  rowsFor, wallWidth, wallHeight, slotCenter, displayModeFor, fitScale, distFor,
  sizeFrac, boxScaleFor, modelScaleFrac,
} from "./shelfLayout.js";

// Warm birch, lit like a product shot — sits on a bright surface, not felt.
const WOOD = {
  frame: "#cdb78f",
  back: "#ece2cf",
  backHover: "#f6efe0",
  plaque: "#b89a6f",
  stud: "#dccaa8",     // faint stud marks in empty compartments
};
const PLAQUE_TEXT = "#2a2620"; // dark ink on the now-light plaque
const PLAQUE_SUB = "#7c6a4d";  // muted brown sub-line

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");

// ---------------------------------------------------------------- structure

function Frame({ rows }) {
  const W = wallWidth();
  const H = wallHeight(rows);
  const boards = [];
  for (let r = 0; r <= rows; r++) boards.push(H / 2 - r * (CELL_H + FRAME_T) - FRAME_T / 2);
  const dividers = [];
  for (let c = 0; c <= COLS; c++) dividers.push(-W / 2 + c * (CELL_W + FRAME_T) + FRAME_T / 2);
  return (
    <group>
      {/* casing behind everything */}
      <mesh position={[0, 0, -0.31]} receiveShadow>
        <boxGeometry args={[W + 1.6, H + 1.6, 0.6]} />
        <meshStandardMaterial color={WOOD.back} roughness={0.92} />
      </mesh>
      {boards.map((y, i) => (
        <mesh key={`b${i}`} position={[0, y, CELL_D / 2]} castShadow receiveShadow>
          <boxGeometry args={[W, FRAME_T, CELL_D]} />
          <meshStandardMaterial color={WOOD.frame} roughness={0.8} />
        </mesh>
      ))}
      {/* dividers sit a hair proud (face-frame look) so fronts never z-fight */}
      {dividers.map((x, i) => (
        <mesh key={`d${i}`} position={[x, 0, CELL_D / 2 + 0.03]} castShadow receiveShadow>
          <boxGeometry args={[FRAME_T, H, CELL_D + 0.06]} />
          <meshStandardMaterial color={WOOD.frame} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// Empty compartment: just a faint patch of stud marks on the shelf floor.
function EmptySlot({ center }) {
  const floorY = center[1] - CELL_H / 2;
  const studs = useMemo(() => {
    const out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push([i * 1.7, j * 1.4]);
    return out;
  }, []);
  return (
    <group position={[center[0], floorY, CELL_D / 2]}>
      {studs.map(([dx, dz], k) => (
        <mesh key={k} position={[dx, 0.1, dz]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 12]} />
          <meshStandardMaterial color={WOOD.stud} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ content

// The closed retail box at the back of a diorama is the SAME sealed carton the
// pack ritual folds shut — the shared <ClosedCarton> — so the box on the shelf
// and the box in the animation are one construction. The painted front fades in
// once the refcounted texture resolves.
function ShelfBox({ item }) {
  const tex = useShelfBoxTexture(item);
  return <ClosedCarton frontTex={tex} />;
}

// A small museum-style name card, tucked into the front-LEFT corner so it
// clears the box art and the legolized model (which sits front-right at
// MODEL_X) instead of covering them. Left-anchored text keeps it compact.
function Plaque({ x, floorY, title, sub }) {
  return (
    <group position={[x - CELL_W / 2 + 2.5, floorY + 0.42, CELL_D - 0.7]}>
      <mesh castShadow>
        <boxGeometry args={[3.8, 0.78, 0.12]} />
        <meshStandardMaterial color={WOOD.plaque} roughness={0.6} metalness={0.1} />
      </mesh>
      <Text position={[-1.7, sub ? 0.12 : 0, 0.08]} fontSize={0.27} maxWidth={3.4} color={PLAQUE_TEXT} anchorX="left" anchorY="middle">
        {title}
      </Text>
      {sub && (
        <Text position={[-1.7, -0.2, 0.08]} fontSize={0.19} color={PLAQUE_SUB} anchorX="left" anchorY="middle">
          {sub}
        </Text>
      )}
    </group>
  );
}

function SetCompartment({ item, center, maxBricks, onSelect, onRemove }) {
  const [hover, setHover] = useState(false);
  const down = useRef([0, 0]);
  const [cx, cy] = center;
  const floorY = cy - CELL_H / 2;

  // Legacy saved sets get the in-place plate upgrade, same as SetDetail.
  const bm = useMemo(() => normalizeAdapted(item.brickModel), [item.brickModel]);
  const mode = bm ? displayModeFor(bm) : "box-only";

  // size ∝ pieces: this set's weight relative to the biggest one on the shelf,
  // driving both its carton size and its build's size (see shelfLayout.sizeFrac).
  const frac = sizeFrac(item.nBricks || bm?.bricks?.length || 0, maxBricks);

  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "auto";
    return () => { document.body.style.cursor = "auto"; };
  }, [hover]);

  // Memoised element: hover re-renders don't reconcile thousands of instances.
  const modelNode = useMemo(() => {
    if (!bm || mode !== "model") return null;
    return (
      <group position={modelOffset(bm.grid)}>
        <BrickInstances bricks={bm.bricks} studs={false} />
      </group>
    );
  }, [bm, mode]);

  // model fits the cell, then shrinks with the set's size weight so a small set's
  // build doesn't balloon to fill the compartment like a flagship's does
  const scale = bm && mode === "model" ? fitScale(bm) * modelScaleFrac(frac) : 1;
  const lift = hover ? 1.03 : 1;
  // box grows with the set; over-budget sets lose the model, so their box steps
  // up a touch and takes centre stage
  const boxScale = boxScaleFor(frac) * (mode === "box-only" ? 1.07 : 1);
  const boxX = mode === "box-only" ? 0 : BOX_X;
  const title = truncate(item.title || "Untitled set", 16);
  const sub = [item.setNumber, item.nBricks ? `${item.nBricks.toLocaleString()} pcs` : null]
    .filter(Boolean).join(" · ");

  return (
    <group>
      {/* compartment back — receives the set's shadow, brightens on hover */}
      <mesh position={[cx, cy, 0.04]} receiveShadow>
        <planeGeometry args={[CELL_W, CELL_H]} />
        <meshStandardMaterial color={hover ? WOOD.backHover : WOOD.back} roughness={0.95} />
      </mesh>

      {/* the retail box at the back of the diorama — breathes on hover */}
      <group
        position={[cx + boxX, floorY + (BOX.BH * boxScale) / 2 + 0.02, BOX_Z]}
        rotation={[0, BOX_YAW, 0]}
        scale={boxScale * (hover ? 1.015 : 1)}
      >
        <ShelfBox item={item} />
      </group>

      {/* the built model in front — lifts on hover */}
      {modelNode && (
        <group
          position={[cx + MODEL_X, floorY + (worldHeight(bm.grid[2]) * scale * lift) / 2 + 0.02, MODEL_Z]}
          rotation={[0, SET_TILT, 0]}
          scale={scale * lift}
        >
          {modelNode}
        </group>
      )}

      <Plaque x={cx} floorY={floorY} title={title} sub={sub} />

      {/* remove control — DOM affordance, only while hovered */}
      {hover && (
        <Html
          position={[cx + CELL_W / 2 - 1.1, cy + CELL_H / 2 - 1.0, CELL_D / 2 + 0.2]}
          center
          distanceFactor={18}
          zIndexRange={[30, 0]}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
            aria-label={`Remove ${title}`}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white shadow-pop transition hover:bg-brand-red"
          >
            <Trash2 size={18} />
          </button>
        </Html>
      )}

      {/* invisible hit volume: hover + click anywhere in the compartment */}
      <mesh
        position={[cx, cy, CELL_D / 2]}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        onPointerDown={(e) => { down.current = [e.clientX, e.clientY]; }}
        onClick={(e) => {
          // a drag to orbit still ends in a click — ignore it
          if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 6) return;
          e.stopPropagation();
          onSelect(item);
        }}
      >
        <boxGeometry args={[CELL_W, CELL_H, CELL_D]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------- camera + orbit

// Frames the whole wall on mount / resize / row-count change AND whenever the
// user hits Recenter (the `recenter` counter bumps). Between framings the user
// can orbit within a front arc (never behind the shelf), pan (right-drag /
// two-finger) to reach edge or bottom-row sets when zoomed in, and scroll to
// zoom. onChange -> invalidate() is REQUIRED under frameloop="demand" or the
// scene freezes mid-drag.
function OrbitRig({ rows, recenter }) {
  const ref = useRef();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const W = wallWidth();
    const H = wallHeight(rows);
    const fov = (camera.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(1, size.height);
    const fitH = (H / 2 + 1.2) / Math.tan(fov / 2);
    const fitW = (W / 2 + 1.2) / (Math.tan(fov / 2) * aspect);
    const dist = Math.max(fitH, fitW) + 2;
    camera.position.set(0, 0, dist);
    camera.near = 0.1;
    camera.far = dist * 4;
    camera.updateProjectionMatrix();
    const c = ref.current;
    if (c) {
      c.target.set(0, 0, 0);
      c.minDistance = dist * 0.4;
      c.maxDistance = dist * 1.4;
      c.update();
    }
    invalidate();
  }, [camera, size.width, size.height, rows, recenter]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enablePan
      screenSpacePanning
      panSpeed={0.8}
      rotateSpeed={0.7}
      zoomSpeed={0.9}
      minPolarAngle={Math.PI * 0.22}
      maxPolarAngle={Math.PI * 0.70}
      minAzimuthAngle={-0.9}
      maxAzimuthAngle={0.9}
      onChange={() => invalidate()}
    />
  );
}

// ----------------------------------------------------------------- the shelf

export default function ShelfScene({ items, onSelect, onRemove }) {
  const list = (items || []).slice(0, 20);
  const rows = rowsFor(list.length);
  const W = wallWidth();
  const H = wallHeight(rows);
  const slots = rows * COLS;
  // biggest piece count on the shelf — every set's box + build scales against it
  const maxBricks = useMemo(() => list.reduce((mx, it) => Math.max(mx, it.nBricks || 0), 1), [list]);
  // bumped by the Recenter button to re-frame the whole wall after a pan/zoom
  const [recenter, setRecenter] = useState(0);

  // Items changing (e.g. a remove) re-renders the tree; R3F auto-invalidates a
  // frame on commit, so the demand canvas repaints without manual nudging.

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-[linear-gradient(180deg,#fbfbf9,#e9ebe5)]">
      {/* a11y mirror: the canvas is invisible to keyboards and screen readers,
          so the same sets exist as real buttons. Tab reveals them visibly
          (focus:not-sr-only); Enter opens, the second button removes. */}
      <ul aria-label="Saved sets" className="sr-only">
        {list.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onSelect(it)}
              className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10
                         focus:rounded focus:bg-elevated focus:px-3 focus:py-1.5 focus:text-sm focus:text-ink"
            >
              Open {it.title || "Untitled set"}
              {it.setNumber ? `, set ${it.setNumber}` : ""}
              {it.nBricks ? `, ${it.nBricks.toLocaleString()} pieces` : ""}
            </button>
            <button
              type="button"
              onClick={() => onRemove(it.id)}
              className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-14 focus:z-10
                         focus:rounded focus:bg-elevated focus:px-3 focus:py-1.5 focus:text-sm focus:text-brand-red"
            >
              Remove {it.title || "Untitled set"}
            </button>
          </li>
        ))}
      </ul>
      <Canvas
        aria-hidden="true"
        shadows
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, distFor(rows)], fov: 35, near: 0.1, far: 500 }}
      >
        {/* bright product-shot light: a hemisphere fill + one soft key with a
            small (1024) shadow map, tight to the wall. No network HDRI (offline-
            safe); no 2048² room map (that was the always-on room's cost). */}
        <hemisphereLight args={["#ffffff", "#d9dbe1", 1.0]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[-W * 0.18, H * 0.5 + 8, 26]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-(W / 2 + 4)}
          shadow-camera-right={W / 2 + 4}
          shadow-camera-top={H / 2 + 5}
          shadow-camera-bottom={-(H / 2 + 5)}
          shadow-camera-near={1}
          shadow-camera-far={120}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[W * 0.3, -2, 22]} intensity={0.3} />

        <Frame rows={rows} />
        {list.map((it, i) => (
          <SetCompartment key={it.id} item={it} center={slotCenter(i, rows)} maxBricks={maxBricks} onSelect={onSelect} onRemove={onRemove} />
        ))}
        {Array.from({ length: slots - list.length }, (_, k) => (
          <EmptySlot key={`empty-${k}`} center={slotCenter(list.length + k, rows)} />
        ))}

        <OrbitRig rows={rows} recenter={recenter} />
      </Canvas>

      {/* navigation hint + recenter — pan/zoom can lose the wall; one tap re-frames it */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
        <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
          Drag to orbit · right-drag to pan · scroll to zoom
        </span>
        <button
          type="button"
          onClick={() => setRecenter((n) => n + 1)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white shadow-pop backdrop-blur-sm transition hover:bg-black/65"
        >
          <Crosshair size={12} /> Recenter
        </button>
      </div>
    </div>
  );
}
