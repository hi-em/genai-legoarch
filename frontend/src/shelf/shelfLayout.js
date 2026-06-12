// Layout math + display policy for the Shelf Wall collection view.
// All sizes are in world units, matching bricks3d.jsx (1 unit = 1 stud).

import { worldHeight } from "../viewer/bricks3d.jsx";

export const COLS = 4;             // sets per shelf row
export const CELL_W = 11;          // compartment inner width
export const CELL_H = 8.5;         // compartment inner height
export const CELL_D = 7;           // compartment depth (back panel -> front edge)
export const FRAME_T = 0.7;        // shelf board / divider thickness
export const SET_TILT = -0.4;      // display angle of a set on its shelf (rad, about Y)
export const ART_THRESHOLD = 2500; // models above this many bricks show box art, not 3D

export const rowsFor = (n) => Math.max(1, Math.ceil(n / COLS));
export const wallWidth = () => COLS * CELL_W + (COLS + 1) * FRAME_T;
export const wallHeight = (rows) => rows * CELL_H + (rows + 1) * FRAME_T;

// Compartment centre [x, y] for slot i on a wall centred at the origin.
// Slot 0 is top-left (the collection stores newest first).
export function slotCenter(i, rows) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const x = -wallWidth() / 2 + FRAME_T + CELL_W / 2 + col * (CELL_W + FRAME_T);
  const yTop = wallHeight(rows) / 2 - FRAME_T - row * (CELL_H + FRAME_T);
  return [x, yTop - CELL_H / 2];
}

// One canvas holds up to 20 sets, so huge models can't all be live geometry:
// small/medium sets render as instanced 3D boxes, anything above the
// threshold stands in as its saved front-elevation thumb ("box art").
export const displayModeFor = (bm) =>
  (bm?.bricks?.length || 0) > ART_THRESHOLD ? "art" : "model";

// Uniform scale that fits a model inside a compartment at the display tilt.
export function fitScale(bm) {
  const [nx, ny, nz] = bm.grid;
  const h = Math.max(worldHeight(nz), 1);
  const cos = Math.cos(SET_TILT);
  const sin = Math.abs(Math.sin(SET_TILT));
  const projW = nx * cos + ny * sin; // footprint projected onto the wall plane
  const projD = nx * sin + ny * cos; // ...and into the compartment depth
  return Math.min(
    (CELL_W - 2.4) / projW,
    (CELL_H - 2.6) / h,   // headroom + plaque space
    (CELL_D - 1.2) / projD,
    0.5                   // tiny models stay set-sized, not giant single bricks
  );
}
