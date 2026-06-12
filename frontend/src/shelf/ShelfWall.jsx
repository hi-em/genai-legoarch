// The Shelf Wall — the collection as a collector's bookcase: one canvas, a
// warm dark wood grid, each saved set displayed at a slight angle in its own
// compartment with a plaque. Pan/zoom only (MapControls), no orbiting.
//
// Performance contract: every 3D set goes through the instanced legacy-box
// path (BrickInstances studs={false}); sets above ART_THRESHOLD bricks render
// their saved front-elevation thumb as flat "box art" instead (see
// shelfLayout.displayModeFor). frameloop="demand" keeps the wall idle-cheap.
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Canvas, useThree, invalidate } from "@react-three/fiber";
import { MapControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { BrickInstances, modelOffset, worldHeight } from "../viewer/bricks3d.jsx";
import { normalizeAdapted } from "../lib/brickModel.js";
import { frontElevationThumb } from "../lib/thumb.js";
import {
  COLS, CELL_W, CELL_H, CELL_D, FRAME_T, SET_TILT,
  rowsFor, wallWidth, wallHeight, slotCenter, displayModeFor, fitScale,
} from "./shelfLayout.js";

// Warm dark walnut, tuned to sit with the --table felt tokens (#2b2f2c family).
const WOOD = {
  frame: "#3b3128",
  back: "#241f1a",
  backHover: "#3a3128",
  plaque: "#1b1713",
  stud: "#46392c",     // faint stud marks in empty compartments
  boxEdge: "#cdbf9f",  // box-art edges, a muted --brand-tan
};
const PLAQUE_TEXT = "#e9ebe6"; // --on-dark
const PLAQUE_SUB = "#e4cd9e";  // --brand-tan

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

// Flat "box art" stand-in for very large models: the saved front-elevation
// thumb on the front face of a thin box, standing in the compartment.
function BoxArt({ src, size }) {
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(src, () => invalidate());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [src]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh castShadow>
      <boxGeometry args={[size, size, 0.55]} />
      <meshStandardMaterial attach="material-0" color={WOOD.boxEdge} roughness={0.65} />
      <meshStandardMaterial attach="material-1" color={WOOD.boxEdge} roughness={0.65} />
      <meshStandardMaterial attach="material-2" color={WOOD.boxEdge} roughness={0.65} />
      <meshStandardMaterial attach="material-3" color={WOOD.boxEdge} roughness={0.65} />
      <meshStandardMaterial attach="material-4" map={tex} roughness={0.55} />
      <meshStandardMaterial attach="material-5" color={WOOD.boxEdge} roughness={0.65} />
    </mesh>
  );
}

function Plaque({ x, floorY, title, sub }) {
  return (
    <group position={[x, floorY + 0.6, CELL_D - 0.9]}>
      <mesh castShadow>
        <boxGeometry args={[5.6, 1.15, 0.14]} />
        <meshStandardMaterial color={WOOD.plaque} roughness={0.6} metalness={0.15} />
      </mesh>
      <Text position={[0, sub ? 0.18 : 0, 0.1]} fontSize={0.42} color={PLAQUE_TEXT} anchorX="center" anchorY="middle">
        {title}
      </Text>
      {sub && (
        <Text position={[0, -0.31, 0.1]} fontSize={0.28} color={PLAQUE_SUB} anchorX="center" anchorY="middle">
          {sub}
        </Text>
      )}
    </group>
  );
}

function SetCompartment({ item, center, onSelect }) {
  const [hover, setHover] = useState(false);
  const down = useRef([0, 0]);
  const [cx, cy] = center;
  const floorY = cy - CELL_H / 2;

  // Legacy saved sets get the in-place plate upgrade, same as SetDetail.
  const bm = useMemo(() => normalizeAdapted(item.brickModel), [item.brickModel]);
  const mode = bm ? displayModeFor(bm) : "art";

  // Box-art source: the saved thumb, or a freshly drawn elevation (cheap 2D).
  const artSrc = useMemo(() => {
    if (mode !== "art") return null;
    if (item.thumb) return item.thumb;
    try { return bm ? frontElevationThumb(bm, 360) : null; } catch { return null; }
  }, [mode, item.thumb, bm]);

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

  const scale = bm && mode === "model" ? fitScale(bm) : 1;
  const lift = hover ? 1.03 : 1;
  const artSize = Math.min(CELL_W - 3.4, CELL_H - 2.8);
  const title = truncate(item.title || "Untitled set", 24);
  const sub = [item.setNumber, item.nBricks ? `${item.nBricks.toLocaleString()} pcs` : null]
    .filter(Boolean).join(" · ");

  return (
    <group>
      {/* compartment back — receives the set's shadow, brightens on hover */}
      <mesh position={[cx, cy, 0.04]} receiveShadow>
        <planeGeometry args={[CELL_W, CELL_H]} />
        <meshStandardMaterial color={hover ? WOOD.backHover : WOOD.back} roughness={0.95} />
      </mesh>

      {modelNode && (
        <group
          position={[cx, floorY + (worldHeight(bm.grid[2]) * scale * lift) / 2 + 0.02, CELL_D * 0.45]}
          rotation={[0, SET_TILT, 0]}
          scale={scale * lift}
        >
          {modelNode}
        </group>
      )}
      {mode === "art" && artSrc && (
        <group
          position={[cx, floorY + (artSize * lift) / 2 + 0.02, CELL_D * 0.42]}
          rotation={[0, SET_TILT * 0.45, 0]}
          scale={lift}
        >
          <BoxArt src={artSrc} size={artSize} />
        </group>
      )}

      <Plaque x={cx} floorY={floorY} title={title} sub={sub} />

      {/* invisible hit volume: hover + click anywhere in the compartment */}
      <mesh
        position={[cx, cy, CELL_D / 2]}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        onPointerDown={(e) => { down.current = [e.clientX, e.clientY]; }}
        onClick={(e) => {
          // a left-drag pans the wall and still ends in a click — ignore it
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

// ------------------------------------------------------------ camera + pan

function WallControls({ rows }) {
  const ref = useRef();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const W = wallWidth();
  const H = wallHeight(rows);

  // Fit the whole wall on mount / resize / row-count change.
  useLayoutEffect(() => {
    const fit = Math.min(size.width / (W + 5), size.height / (H + 5));
    camera.zoom = fit;
    camera.position.set(0, 0, 60);
    camera.updateProjectionMatrix();
    const c = ref.current;
    if (c) {
      c.target.set(0, 0, 0);
      c.minZoom = fit * 0.85;
      c.maxZoom = Math.max(fit * 6, 60);
      c.update();
    }
  }, [camera, size.width, size.height, W, H]);

  // Clamp the pan target to the wall so you can't wander off into the dark.
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const onChange = () => {
    const c = ref.current;
    if (!c) return;
    const mx = Math.max(0, W / 2 - 6);
    const my = Math.max(0, H / 2 - 3);
    const t = c.target;
    const nx = clamp(t.x, -mx, mx);
    const ny = clamp(t.y, -my, my);
    const dx = nx - t.x;
    const dy = ny - t.y;
    if (dx || dy) {
      t.x = nx; t.y = ny;
      c.object.position.x += dx;
      c.object.position.y += dy;
    }
  };

  return (
    <MapControls
      ref={ref}
      makeDefault
      screenSpacePanning
      enableRotate={false}
      zoomToCursor
      onChange={onChange}
    />
  );
}

// ----------------------------------------------------------------- the wall

export default function ShelfWall({ items, onSelect }) {
  const list = (items || []).slice(0, 20);
  const rows = rowsFor(list.length);
  const W = wallWidth();
  const H = wallHeight(rows);
  const slots = rows * COLS;

  if (list.length === 0) {
    return (
      <div className="grid h-full w-full place-items-center rounded-xl border border-border-dark bg-table-deep text-sm text-on-dark-muted">
        No sets on the shelf yet.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-border-dark bg-table-deep">
      <Canvas
        shadows
        orthographic
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 60], zoom: 12, near: 0.1, far: 200 }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[-W * 0.2, H * 0.55 + 6, 24]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-(W / 2 + 5)}
          shadow-camera-right={W / 2 + 5}
          shadow-camera-top={H / 2 + 6}
          shadow-camera-bottom={-(H / 2 + 6)}
          shadow-camera-near={1}
          shadow-camera-far={120}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[W * 0.3, -4, 18]} intensity={0.25} />

        <Frame rows={rows} />
        {list.map((it, i) => (
          <SetCompartment key={it.id} item={it} center={slotCenter(i, rows)} onSelect={onSelect} />
        ))}
        {Array.from({ length: slots - list.length }, (_, k) => (
          <EmptySlot key={`empty-${k}`} center={slotCenter(list.length + k, rows)} />
        ))}

        <WallControls rows={rows} />
      </Canvas>
    </div>
  );
}
