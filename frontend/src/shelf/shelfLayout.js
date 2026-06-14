// Layout math + display policy for the Shelf Wall collection view.
// All sizes are in world units, matching bricks3d.jsx (1 unit = 1 stud).

import { worldHeight } from "../viewer/bricks3d.jsx";

export const COLS = 4;             // sets per shelf row
export const CELL_W = 11;          // compartment inner width
export const CELL_H = 8.5;         // compartment inner height
export const CELL_D = 7;           // compartment depth (back panel -> front edge)
export const FRAME_T = 0.7;        // shelf board / divider thickness
export const SET_TILT = -0.4;      // display angle of a set on its shelf (rad, about Y)
export const MODEL_BRICK_BUDGET = 12000; // models above this show as a hero box only

// Diorama composition: the retail box sits at the back of the compartment
// (slightly left, yawed toward the viewer), the built model stands in front.
export const BOX_SCALE = 2.25;     // box size in world units (BOX.* × this)
export const BOX_X = -0.35;        // box x offset from the compartment centre
export const BOX_Z = 0.95;         // box depth position (back of the diorama)
export const BOX_YAW = 0.12;       // box yaw toward the viewer (rad, about Y)
export const MODEL_X = 0.4;        // model x offset from the compartment centre
export const MODEL_Z = 3.7;        // model depth position (front of the diorama)

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
// sets within the budget show the full diorama (box + instanced 3D model),
// anything above it shows a centred hero box instead.
export const displayModeFor = (bm) =>
  (bm?.bricks?.length || 0) <= MODEL_BRICK_BUDGET ? "model" : "box-only";

// Perspective camera distance that frames the whole wall with a small margin.
// `aspect` defaults wide; ShelfScene refines it with the live canvas aspect on
// mount. Used both for the Canvas's initial camera and the orbit min/max range.
export function distFor(rows, fovDeg = 35, aspect = 1.6) {
  const H = wallHeight(rows);
  const W = wallWidth();
  const fov = (fovDeg * Math.PI) / 180;
  const fitH = (H / 2 + 1.2) / Math.tan(fov / 2);
  const fitW = (W / 2 + 1.2) / (Math.tan(fov / 2) * aspect);
  return Math.max(fitH, fitW) + 2;
}

// Uniform scale that fits a model inside a compartment at the display tilt.
// Margins leave room for the box peeking past the model's edges and keep the
// model clear of the plaque at the compartment front.
export function fitScale(bm) {
  const [nx, ny, nz] = bm.grid;
  const h = Math.max(worldHeight(nz), 1);
  const cos = Math.cos(SET_TILT);
  const sin = Math.abs(Math.sin(SET_TILT));
  const projW = nx * cos + ny * sin; // footprint projected onto the wall plane
  const projD = nx * sin + ny * cos; // ...and into the compartment depth
  return Math.min(
    (CELL_W - 3.0) / projW,
    (CELL_H - 3.8) / h,   // headroom + plaque space
    (CELL_D - 3.4) / projD,
    0.5                   // tiny models stay set-sized, not giant single bricks
  );
}
