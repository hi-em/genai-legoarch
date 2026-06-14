// Isometric step renderer for the instruction booklet. Draws the build up to a
// given COURSE (3 plate layers), with the newly-added course highlighted and
// prior courses muted — the classic LEGO-manual convention. Pure 2D canvas.
import { courseOf } from "./brickModel.js";

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);
const PLATE_RATIO = 0.4;   // one plate layer = 0.4 stud units of height

// shade a hex by a factor (top brightest, sides darker) for fake lighting
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// project grid (x,y,z) -> screen (origin-relative), z is up
function project(x, y, z, s) {
  return [(x - y) * COS30 * s, (x + y) * SIN30 * s - z * s];
}

function drawBrick(ctx, b, s, ox, oy, muted) {
  const w = b.w || 1, d = b.d || 1, h = b.h || 3;
  const x0 = b.x, x1 = b.x + w, y0 = b.y, y1 = b.y + d;
  const z0 = b.z * PLATE_RATIO, z1 = (b.z + h) * PLATE_RATIO;
  const P = (x, y, z) => {
    const [px, py] = project(x, y, z, s);
    return [px + ox, py + oy];
  };
  const hex = b.hex || "#cccccc";
  const a = muted ? 0.45 : 1;
  ctx.globalAlpha = a;
  // top face (z1)
  ctx.fillStyle = shade(hex, muted ? 0.85 : 1.0);
  ctx.beginPath();
  let p = P(x0, y0, z1); ctx.moveTo(p[0], p[1]);
  p = P(x1, y0, z1); ctx.lineTo(p[0], p[1]);
  p = P(x1, y1, z1); ctx.lineTo(p[0], p[1]);
  p = P(x0, y1, z1); ctx.lineTo(p[0], p[1]);
  ctx.closePath(); ctx.fill();
  // left face (y1)
  ctx.fillStyle = shade(hex, muted ? 0.6 : 0.72);
  ctx.beginPath();
  p = P(x0, y1, z1); ctx.moveTo(p[0], p[1]);
  p = P(x1, y1, z1); ctx.lineTo(p[0], p[1]);
  p = P(x1, y1, z0); ctx.lineTo(p[0], p[1]);
  p = P(x0, y1, z0); ctx.lineTo(p[0], p[1]);
  ctx.closePath(); ctx.fill();
  // right face (x1)
  ctx.fillStyle = shade(hex, muted ? 0.5 : 0.6);
  ctx.beginPath();
  p = P(x1, y0, z1); ctx.moveTo(p[0], p[1]);
  p = P(x1, y1, z1); ctx.lineTo(p[0], p[1]);
  p = P(x1, y1, z0); ctx.lineTo(p[0], p[1]);
  p = P(x1, y0, z0); ctx.lineTo(p[0], p[1]);
  ctx.closePath(); ctx.fill();
  // outline the newly-placed course
  if (!muted) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(20,30,25,.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Render the build up to and including COURSE `uptoCourse`. Returns a PNG data URL.
export function isoStepThumb(bm, uptoCourse, size = 360, bg = "#f4f6f4") {
  const [nx, ny, nz] = bm.grid;                  // nz in plate layers
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // scale so the model fits
  const hWorld = nz * PLATE_RATIO;
  const spanX = (nx + ny) * COS30;
  const spanY = (nx + ny) * SIN30 + hWorld;
  const s = (size * 0.82) / Math.max(spanX, spanY);
  // Centre the model's PROJECTED bounding box in the canvas. project() maps
  // (x,y,z)->[(x-y)·COS30·s, (x+y)·SIN30·s − z·s], so over x∈[0,nx], y∈[0,ny],
  // z∈[0,hWorld] the extremes are px∈[−ny·COS30·s, nx·COS30·s] and
  // py∈[−hWorld·s, (nx+ny)·SIN30·s]. Offsetting by the box centre keeps tall
  // and non-square models centred instead of clipped low (the old fixed
  // 0.62·size + hWorld/2 pushed tall builds off the bottom). Shared with the PDF.
  const ox = size / 2 - ((nx - ny) * COS30 * s) / 2;
  const oy = size / 2 - (((nx + ny) * SIN30 - hWorld) * s) / 2;

  // painter's order: back-to-front, bottom-to-top
  const visible = bm.bricks
    .filter((b) => courseOf(b) <= uptoCourse)
    .sort((a, b) => (a.x + a.y + a.z * PLATE_RATIO) - (b.x + b.y + b.z * PLATE_RATIO));
  for (const b of visible) drawBrick(ctx, b, s, ox, oy, courseOf(b) < uptoCourse);
  return canvas.toDataURL("image/png");
}
