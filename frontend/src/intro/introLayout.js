// Deterministic layout math for the launch intro montage.
// House rule: no Math.random — every value derives from the tile index, so
// the cascade plays identically on every load.

// Per-index pseudo-random in [0, 1) — the classic sin hash, salted.
export const rnd = (i, salt) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const GRID_COLS = 8;

// Deterministic permutation of [0..n-1] — splits the dataset's adjacent
// near-duplicate views (lexicographic order pairs two shots of the same set)
// without Math.random. Bump the salt if a bad neighbour pair survives.
export const shuffledOrder = (n, salt = 7) =>
  Array.from({ length: n }, (_, i) => i).sort((a, b) => rnd(a, salt) - rnd(b, salt) || a - b);

// The 8 grid slots that stamp into letter plates (l E g o a r C h).
// Letter k lives in column k — lockup flights never cross horizontally —
// and the rows zigzag around the vertical centre to spread the stamps.
export const STAMP_SLOTS = [16, 9, 26, 19, 12, 29, 14, 23];

// Viewport-aware grid pitch: fill up to 96% of the width and 72% of the
// height, whichever is tighter. Tiles are sized in px (not vmin) so the
// lockup math and resize handling share one coordinate space.
export const gridPitchPx = (w, h, rows) => Math.min((0.96 * w) / GRID_COLS, (0.72 * h) / rows);
export const TILE_RATIO = 0.88; // tile edge / pitch — keeps the old 9/10.2 gutter feel

/**
 * Layout for tile `i` of `n`:
 *  - from:  off-screen origin on one of the 4 viewport edges ({ xVw, yVh },
 *           offsets from viewport center)
 *  - grid:  slot in the centered 8-wide grid, in PITCH UNITS from center
 *           ({ ux, uy } — multiply by the live pitch for px)
 *  - rot:   initial rotation, −6..6°
 *  - delay: cascade stagger in seconds
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
    grid: { ux: col - cx, uy: row - cy },
    rot: rnd(i, 3) * 12 - 6,
    // tightened from 0.045 so the LAST tile is at rest well before the stamp
    // beat: launch 450 + 39×28 ≈ 1.54s, spring settle ≈ 1s → grid holds ~850ms
    delay: i * 0.028,
  };
}
