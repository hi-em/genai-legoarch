// Shared three.js brick primitives — used by both the static BrickViewer and the
// animated AssemblyViewer so they stay visually identical.
//
// A piece covers a w*d footprint anchored at grid corner (x, y) with its bottom
// on PLATE layer z and a height of h plates (3 = brick, 1 = plate/tile). Grid
// (x, y, z=up) maps to three (X=x, Y=z, Z=y); 1 world unit = 1 stud, one plate
// = 0.4 units (real LEGO proportion: 3.2 mm / 8 mm), so a brick is 1.2 tall.
//
// Rendering has two paths:
//  - REAL: one <Instances> batch per part id using the actual LDraw moulded
//    geometry (studs, slopes, arches included), per-instance colour + Y
//    rotation (rot 0/90/180/270). w/d arrive as-placed from the backend, so
//    the canonical geometry is rotated and positioned at the placed
//    footprint's centre.
//  - LEGACY: one box scaled to the footprint + scattered stud cylinders.
//    Used while geometry streams in, for any part that fails to load, and
//    when `studs={false}` asks for the cheap look (posters, far shelves).
import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { BASEPLATE, MONO_BRICK } from "../lib/tokens.js";
import { STUDLESS } from "../lib/brickModel.js";
import { usePartGeometries } from "./partGeometry.js";

const GAP = 0.06;        // mortar line between adjacent bricks
export const PLATE_Y = 0.4;  // one plate layer in world units (3.2/8 mm)
const GAP_Y = 0.05;      // horizontal mortar line between stacked pieces
const STUD_H = 0.2;
const BASE_Y = -0.5;     // world y of the model's bottom face (baseplate top)
const PART_FIT = 0.985;  // slight uniform shrink so real parts read as pieces

// World height of the model (nz in plate layers).
export const worldHeight = (nz) => nz * PLATE_Y;

// Translate so the model is centred at the origin (X/Z) and vertically centred
// (Y), which keeps the orbit camera framed on the middle of the build.
export function modelOffset([nx, ny, nz]) {
  return [-(nx - 1) / 2, -BASE_Y - worldHeight(nz) / 2, -(ny - 1) / 2];
}

function boxesOf(bricks) {
  return bricks.map((b) => {
    const w = b.w || 1, d = b.d || 1, h = b.h || 3;
    return {
      pos: [b.x + (w - 1) / 2, BASE_Y + (b.z + h / 2) * PLATE_Y, b.y + (d - 1) / 2],
      scale: [Math.max(0.1, w - GAP), Math.max(0.1, h * PLATE_Y - GAP_Y), Math.max(0.1, d - GAP)],
      hex: b.hex,
    };
  });
}

function studsOf(bricks) {
  const out = [];
  for (const b of bricks) {
    if (STUDLESS.has(b.part)) continue;        // tiles are the smooth finish
    const w = b.w || 1, d = b.d || 1, h = b.h || 3;
    const top = BASE_Y + (b.z + h) * PLATE_Y;
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++)
        out.push({ pos: [b.x + i, top + STUD_H / 2 - 0.04, b.y + j], hex: b.hex });
  }
  return out;
}

// Our instances never move after mount — without `frames`, drei re-decomposes
// and re-uploads EVERY instance matrix EVERY frame (10k+ pieces = real jank).
// frames={2}: one frame to apply transforms, one to settle.
const STATIC_FRAMES = 2;

function LegacyBoxes({ bricks, studs, colorOf, clippingPlanes }) {
  const boxes = boxesOf(bricks);
  const studList = studs ? studsOf(bricks) : [];
  return (
    <group>
      <Instances limit={boxes.length} frames={STATIC_FRAMES} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.55} metalness={0} clippingPlanes={clippingPlanes} />
        {boxes.map((b, i) => (
          <Instance key={i} position={b.pos} scale={b.scale} color={colorOf(b.hex)} />
        ))}
      </Instances>
      {studList.length > 0 && (
        <Instances limit={studList.length} frames={STATIC_FRAMES} castShadow>
          <cylinderGeometry args={[0.28, 0.28, STUD_H, 14]} />
          <meshStandardMaterial roughness={0.5} clippingPlanes={clippingPlanes} />
          {studList.map((s, i) => (
            <Instance key={i} position={s.pos} color={colorOf(s.hex)} />
          ))}
        </Instances>
      )}
    </group>
  );
}

export function BrickInstances({ bricks, studs = true, monochrome = false, clippingPlanes }) {
  const list = bricks || [];
  // hooks run unconditionally; studs=false keeps the cheap legacy look and
  // skips geometry loading entirely
  const partIds = useMemo(
    () => (studs ? [...new Set(list.map((b) => b.part))] : []),
    [list, studs]
  );
  const { ready, geos } = usePartGeometries(partIds);
  const byPart = useMemo(() => {
    if (!studs || !ready) return null;
    const m = new Map();
    for (const b of list) {
      if (!m.has(b.part)) m.set(b.part, []);
      m.get(b.part).push(b);
    }
    return m;
  }, [list, studs, ready]);

  if (list.length === 0) return null;
  const colorOf = (hex) => (monochrome ? MONO_BRICK : hex);

  if (!byPart) {
    return <LegacyBoxes bricks={list} studs={studs} colorOf={colorOf} clippingPlanes={clippingPlanes} />;
  }

  const real = [];
  const fallback = [];
  for (const [part, group] of byPart) {
    if (geos.get(part)) real.push([part, group]);
    else fallback.push(...group);
  }
  return (
    <group>
      {real.map(([part, group]) => (
        <Instances key={part} limit={group.length} frames={STATIC_FRAMES} castShadow receiveShadow>
          <primitive object={geos.get(part)} attach="geometry" />
          <meshStandardMaterial roughness={0.55} metalness={0} clippingPlanes={clippingPlanes} />
          {group.map((b, i) => {
            const w = b.w || 1, d = b.d || 1;
            return (
              <Instance
                key={i}
                position={[b.x + (w - 1) / 2, BASE_Y + b.z * PLATE_Y, b.y + (d - 1) / 2]}
                rotation={[0, (-(b.rot || 0) * Math.PI) / 180, 0]}
                scale={PART_FIT}
                color={colorOf(b.hex)}
              />
            );
          })}
        </Instances>
      ))}
      {fallback.length > 0 && (
        <LegacyBoxes bricks={fallback} studs={studs} colorOf={colorOf} clippingPlanes={clippingPlanes} />
      )}
    </group>
  );
}

// A muted-green studded baseplate the model rests on (premium "set on a table").
export function Baseplate({ nx, ny, margin = 2 }) {
  const x0 = -margin, x1 = nx - 1 + margin;
  const y0 = -margin, y1 = ny - 1 + margin;
  const w = x1 - x0 + 1, d = y1 - y0 + 1;
  const cx = (x0 + x1) / 2, cz = (y0 + y1) / 2;
  const topY = -0.5, thick = 0.5;

  const studs = [];
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) studs.push([i, j]);

  return (
    <group>
      <mesh position={[cx, topY - thick - 0.12, cz]} receiveShadow>
        <boxGeometry args={[w + 0.25, 0.3, d + 0.25]} />
        <meshStandardMaterial color={BASEPLATE.edge} roughness={0.85} />
      </mesh>
      <mesh position={[cx, topY - thick / 2, cz]} receiveShadow castShadow>
        <boxGeometry args={[w, thick, d]} />
        <meshStandardMaterial color={BASEPLATE.top} roughness={0.78} />
      </mesh>
      <Instances limit={studs.length} frames={STATIC_FRAMES}>
        <cylinderGeometry args={[0.28, 0.28, 0.2, 14]} />
        <meshStandardMaterial color={BASEPLATE.stud} roughness={0.65} />
        {studs.map(([i, j], k) => (
          <Instance key={k} position={[i, topY + 0.08, j]} />
        ))}
      </Instances>
    </group>
  );
}
