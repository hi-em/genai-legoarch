// Client-side legolizer (mirrors backend/app/legolizer). REAL, not mocked:
// voxel grid -> bricks -> legoarch-style colors -> stability -> parts list.
import { cellAt } from "./voxel.js";
import { byCode } from "./palette.js";

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Assign a legoarch-ish palette: light-grey base, pearl-white body, the odd
// translucent-yellow "window" tile, a grey crown. Colorless solvers can't do
// this — explicit assignment is what keeps the signature look.
function colorFor(x, y, z, m, rng) {
  if (z < 2) return 151;                 // light bluish grey podium
  if (z >= m.nz - 2) return 72;          // dark grey crown
  const onEdge = !cellAt(m, x + 1, y, z) || !cellAt(m, x - 1, y, z) ||
                 !cellAt(m, x, y + 1, z) || !cellAt(m, x, y - 1, z);
  if (onEdge && rng() < 0.16) return 46; // trans-yellow window tile
  return rng() < 0.12 ? 71 : 15;         // mostly white, some light grey
}

export function legolize(m, seed = 1) {
  const rng = mulberry32(seed >>> 0 || 1);
  const bricks = [];
  for (let z = 0; z < m.nz; z++)
    for (let x = 0; x < m.nx; x++)
      for (let y = 0; y < m.ny; y++)
        if (cellAt(m, x, y, z)) {
          const code = colorFor(x, y, z, m, rng);
          bricks.push({ part: "3005", x, y, z, color: code, hex: byCode[code].hex, rot: 0 });
        }
  const stability = analyze(m, bricks);
  const parts = partsList(bricks);
  return { grid: [m.nx, m.ny, m.nz], unit_mm: 8, bricks, stability, parts };
}

// connectivity (6-neighbour flood) + coarse support ratio
export function analyze(m, bricks) {
  if (!bricks.length) return { connected: true, components: 0, supportRatio: 1, nBricks: 0 };
  const key = (x, y, z) => `${x},${y},${z}`;
  const set = new Set(bricks.map((b) => key(b.x, b.y, b.z)));
  const seen = new Set();
  let components = 0;
  for (const b of bricks) {
    const k0 = key(b.x, b.y, b.z);
    if (seen.has(k0)) continue;
    components++;
    const stack = [[b.x, b.y, b.z]];
    seen.add(k0);
    while (stack.length) {
      const [x, y, z] = stack.pop();
      for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const k = key(x + dx, y + dy, z + dz);
        if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push([x + dx, y + dy, z + dz]); }
      }
    }
  }
  let above = 0, supported = 0;
  for (const b of bricks) {
    if (b.z === 0) continue;
    above++;
    if (set.has(key(b.x, b.y, b.z - 1))) supported++;
  }
  const supportRatio = above === 0 ? 1 : supported / above;
  return {
    connected: components <= 1,
    components,
    supportRatio: Math.round(supportRatio * 1000) / 1000,
    nBricks: bricks.length,
  };
}

export function partsList(bricks) {
  const out = {};
  for (const b of bricks) {
    const k = `${b.part}|${b.color}`;
    out[k] = (out[k] || 0) + 1;
  }
  return Object.entries(out).map(([k, qty]) => {
    const [part, code] = k.split("|");
    return { part, color: Number(code), name: byCode[Number(code)].name, hex: byCode[Number(code)].hex, qty };
  }).sort((a, b) => b.qty - a.qty);
}
