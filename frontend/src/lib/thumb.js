// Cheap front-elevation thumbnail (no WebGL) for the collection shelf.
// z is in PLATE layers: one plate row = 0.4 of a stud cell, so proportions
// match the real 8 x 3.2 mm brick geometry.
const PLATE_RATIO = 0.4;

export function frontElevationThumb(bm, size = 240) {
  const [nx, , nz] = bm.grid;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#eef3f7");
  grad.addColorStop(1, "#dfe7ee");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const hWorld = nz * PLATE_RATIO;                 // model height in stud units
  const cell = Math.min(size / (nx + 2), size / (hWorld + 2));
  const ox = (size - nx * cell) / 2;
  const oy = (size - hWorld * cell) / 2;
  // frontmost (min depth) piece per (x, plate-z) cell, drawn per plate row
  const front = {};
  for (const b of bm.bricks) {
    const h = b.h || 3;
    for (let dx = 0; dx < (b.w || 1); dx++)
      for (let dz = 0; dz < h; dz++) {
        const k = (b.x + dx) + "," + (b.z + dz);
        if (!(k in front) || b.y > front[k].y) front[k] = b;
      }
  }
  for (const k in front) {
    const [cx, cz] = k.split(",").map(Number);
    ctx.fillStyle = front[k].hex;
    const px = ox + cx * cell;
    const py = size - oy - (cz + 1) * cell * PLATE_RATIO;
    ctx.fillRect(px, py, cell - 1, cell * PLATE_RATIO);
  }
  return canvas.toDataURL("image/png");
}
