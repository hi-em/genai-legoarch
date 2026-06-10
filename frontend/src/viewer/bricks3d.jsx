// Shared three.js brick primitives — used by both the static BrickViewer and the
// animated AssemblyViewer so they stay visually identical.
//
// A brick covers a w*d footprint anchored at grid corner (x, y) on layer z.
// Grid (x, y, z=up) maps to three (X=x, Y=z, Z=y). A footprint is drawn as ONE
// box scaled to its extent (orientation-agnostic) with w*d studs scattered on top.
import { Instances, Instance } from "@react-three/drei";
import { BASEPLATE, MONO_BRICK } from "../lib/tokens.js";

const GAP = 0.06;        // mortar line between adjacent bricks
const BRICK_H = 0.92;    // brick body height (one course)
const STUD_H = 0.2;

// Translate so the model is centred at the origin (X/Z) and vertically centred
// (Y), which keeps the orbit camera framed on the middle of the build.
export function modelOffset([nx, ny, nz]) {
  return [-(nx - 1) / 2, -(nz - 1) / 2, -(ny - 1) / 2];
}

function boxesOf(bricks) {
  return bricks.map((b) => {
    const w = b.w || 1, d = b.d || 1;
    return {
      pos: [b.x + (w - 1) / 2, b.z, b.y + (d - 1) / 2],
      scale: [Math.max(0.1, w - GAP), BRICK_H, Math.max(0.1, d - GAP)],
      hex: b.hex,
    };
  });
}

function studsOf(bricks) {
  const out = [];
  for (const b of bricks) {
    const w = b.w || 1, d = b.d || 1;
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++)
        out.push({ pos: [b.x + i, b.z + BRICK_H / 2 + STUD_H / 2 - 0.04, b.y + j], hex: b.hex });
  }
  return out;
}

export function BrickInstances({ bricks, studs = true, monochrome = false }) {
  if (!bricks || bricks.length === 0) return null;
  const boxes = boxesOf(bricks);
  const studList = studs ? studsOf(bricks) : [];
  const colorOf = (hex) => (monochrome ? MONO_BRICK : hex);
  return (
    <group>
      <Instances limit={boxes.length} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.55} metalness={0} />
        {boxes.map((b, i) => (
          <Instance key={i} position={b.pos} scale={b.scale} color={colorOf(b.hex)} />
        ))}
      </Instances>
      {studList.length > 0 && (
        <Instances limit={studList.length} castShadow>
          <cylinderGeometry args={[0.28, 0.28, STUD_H, 14]} />
          <meshStandardMaterial roughness={0.5} />
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
