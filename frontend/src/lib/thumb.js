// Cheap front-elevation thumbnail (no WebGL) for the collection shelf.
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

  const cell = Math.min(size / (nx + 2), size / (nz + 2));
  const ox = (size - nx * cell) / 2;
  const oy = (size - nz * cell) / 2;
  // frontmost (max y) brick per (x,z) column
  const front = {};
  for (const b of bm.bricks) {
    const k = b.x + "," + b.z;
    if (!(k in front) || b.y > front[k].y) front[k] = b;
  }
  for (const k in front) {
    const b = front[k];
    ctx.fillStyle = b.hex;
    const px = ox + b.x * cell;
    const py = size - oy - (b.z + 1) * cell;
    ctx.fillRect(px, py, cell - 1, cell - 1);
  }
  return canvas.toDataURL("image/png");
}
