// Shared three.js brick primitives — used by both the static BrickViewer and the
// animated AssemblyViewer so they stay visually identical.
//
// A piece covers a w*d footprint anchored at grid corner (x, y) with its bottom
// on PLATE layer z and a height of h plates (3 = brick, 1 = plate/tile). Grid
// (x, y, z=up) maps to three (X=x, Y=z, Z=y); 1 world unit = 1 stud, one plate
// = 0.4 units (real LEGO proportion: 3.2 mm / 8 mm), so a brick is 1.2 tall.
// A footprint is drawn as ONE box scaled to its extent (orientation-agnostic)
// with w*d studs scattered on top — unless the part is a studless tile.
import { Instances, Instance } from "@react-three/drei";
import { BASEPLATE, MONO_BRICK } from "../lib/tokens.js";
import { STUDLESS } from "../lib/brickModel.js";

const GAP = 0.06;        // mortar line between adjacent bricks
export const PLATE_Y = 0.4;  // one plate layer in world units (3.2/8 mm)
const GAP_Y = 0.05;      // horizontal mortar line between stacked pieces
const STUD_H = 0.2;
const BASE_Y = -0.5;     // world y of the model's bottom face (baseplate top)

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

export function BrickInstances({ bricks, studs = true, monochrome = false, clippingPlanes }) {
  if (!bricks || bricks.length === 0) return null;
  const boxes = boxesOf(bricks);
  const studList = studs ? studsOf(bricks) : [];
  const colorOf = (hex) => (monochrome ? MONO_BRICK : hex);
  return (
    <group>
      <Instances limit={boxes.length} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.55} metalness={0} clippingPlanes={clippingPlanes} />
        {boxes.map((b, i) => (
          <Instance key={i} position={b.pos} scale={b.scale} color={colorOf(b.hex)} />
        ))}
      </Instances>
      {studList.length > 0 && (
        <Instances limit={studList.length} castShadow>
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
      <Instances limit={studs.length}>
        <cylinderGeometry args={[0.28, 0.28, 0.2, 14]} />
        <meshStandardMaterial color={BASEPLATE.stud} roughness={0.65} />
        {studs.map(([i, j], k) => (
          <Instance key={k} position={[i, topY + 0.08, j]} />
        ))}
      </Instances>
    </group>
  );
}
