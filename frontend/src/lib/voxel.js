// Deterministic procedural "building" voxel generator.
// Stands in for the FLUX->TRELLIS geometry until ComfyUI is wired: every prompt
// yields a different, repeatable tiered massing so the rest of the pipeline
// (legolize, stability, export, shelf) is REAL and testable now.

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idx = (x, y, z, nx, ny) => x + nx * (y + ny * z);

// Returns { nx, ny, nz, occ: Uint8Array } with occ[idx]=1 if filled.
export function generateBuilding(prompt, styleSeed = 0) {
  const rng = mulberry32(hashString(`${prompt}::${styleSeed}`));
  const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

  const nx = ri(6, 10);
  const ny = ri(6, 10);
  const nz = ri(10, 18);
  const occ = new Uint8Array(nx * ny * nz);

  // tiered setback tower: shrink footprint as we go up
  let x0 = 0, y0 = 0, x1 = nx - 1, y1 = ny - 1;
  let z = 0;
  const podium = ri(1, 2);
  // podium (full footprint)
  for (; z < podium; z++)
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) occ[idx(x, y, z, nx, ny)] = 1;

  const tiers = ri(2, 4);
  const courtyard = rng() < 0.35 && nx >= 8 && ny >= 8;
  let remaining = nz - podium;
  for (let t = 0; t < tiers && z < nz; t++) {
    const tierH = t === tiers - 1 ? remaining : Math.max(1, Math.round(remaining / (tiers - t) * (0.7 + rng() * 0.6)));
    for (let h = 0; h < tierH && z < nz; h++, z++) {
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          if (courtyard && z < podium + 4 && x > x0 && x < x1 && y > y0 && y < y1) continue; // void
          occ[idx(x, y, z, nx, ny)] = 1;
        }
    }
    remaining -= tierH;
    // setback for next tier (centered, keep at least 3 wide)
    const sx = rng() < 0.8 ? 1 : 0;
    const sy = rng() < 0.8 ? 1 : 0;
    if (x1 - x0 > 3) { x0 += sx; x1 -= sx; }
    if (y1 - y0 > 3) { y0 += sy; y1 -= sy; }
    // occasional asymmetric shift for a Gehry-ish lean
    if (rng() < 0.3 && x1 < nx - 1) { x0 += 1; x1 += 1; }
  }

  // a small rooftop feature
  if (z < nz) {
    const cx = Math.floor((x0 + x1) / 2), cy = Math.floor((y0 + y1) / 2);
    occ[idx(cx, cy, Math.min(z, nz - 1), nx, ny)] = 1;
  }

  return { nx, ny, nz, occ };
}

export const cellAt = (m, x, y, z) =>
  x >= 0 && y >= 0 && z >= 0 && x < m.nx && y < m.ny && z < m.nz
    ? m.occ[idx(x, y, z, m.nx, m.ny)]
    : 0;
