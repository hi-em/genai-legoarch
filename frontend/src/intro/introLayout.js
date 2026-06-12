// Deterministic layout math for the launch intro montage (B5).
// House rule: no Math.random — every value derives from the tile index, so
// the cascade plays identically on every load.

// Per-index pseudo-random in [0, 1) — the classic sin hash, salted.
export const rnd = (i, salt) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const GRID_COLS = 8;
export const TILE_VMIN = 9; // tile edge
const GAP_VMIN = 1.2; // gutter between grid slots
const PITCH = TILE_VMIN + GAP_VMIN; // 10.2vmin grid pitch
const MOSAIC_PITCH = 3.5; // compressed band pitch (≈ PITCH × MOSAIC_SCALE)
export const MOSAIC_SCALE = 0.35;
export const MOSAIC_OPACITY = 0.22;

/**
 * Layout for tile `i` of `n`:
 *  - from:   off-screen origin on one of the 4 viewport edges ({ xVw, yVh },
 *            offsets from viewport center)
 *  - grid:   slot in the centered 8-wide grid ({ xVmin, yVmin } from center)
 *  - mosaic: the same slot compressed into the tight band behind the wordmark
 *  - rot:    initial rotation, −6..6°
 *  - delay:  cascade stagger in seconds
 */
export function tileLayout(i, n) {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  const rows = Math.ceil(n / GRID_COLS);
  const cx = (GRID_COLS - 1) / 2;
  const cy = (rows - 1) / 2;

  // Edge origin: cycle the 4 sides; slide along the edge and push past it by
  // salted amounts so the entries never look gridded.
  const side = i % 4; // 0 left · 1 right · 2 top · 3 bottom
  const along = rnd(i, 1) * 84 - 42; // −42..42 (vh on the sides, vw top/bottom)
  const out = 62 + rnd(i, 2) * 18; // 62..80 — safely past the half-viewport
  const from =
    side === 0 ? { xVw: -out, yVh: along }
    : side === 1 ? { xVw: out, yVh: along }
    : side === 2 ? { xVw: along, yVh: -out }
    : { xVw: along, yVh: out };

  return {
    from,
    grid: { xVmin: (col - cx) * PITCH, yVmin: (row - cy) * PITCH },
    mosaic: { xVmin: (col - cx) * MOSAIC_PITCH, yVmin: (row - cy) * MOSAIC_PITCH },
    rot: rnd(i, 3) * 12 - 6,
    delay: i * 0.045,
  };
}
