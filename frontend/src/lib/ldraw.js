// LDraw (.ldr) export — mirrors backend/app/legolizer/ldraw.py exactly.
// Opens in BrickLink Studio / any LDraw viewer.
//
// Official parts are authored long-axis-along-X, and the 45° slope family is
// authored slope-axis-along-Z, downhill -Z, origin centred on the HIGH stud
// row (10 LDU off the footprint centre). The viewer fixes this at geometry
// load; the exporter applies the same correction algebraically: a quarter
// turn for transposed parts + a rotated origin offset for slopes. Engine
// rotations compose as R(-rot) because LDraw's Y-down flips handedness —
// identical maths to the backend exporter (see its tests).
import catalog from "./catalog.gen.json";

const LDU_PER_STUD = 20;
const LDU_PER_PLATE = 8;   // a brick = 3 plates = 24 LDU

const R0 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const R90 = [0, 0, 1, 0, 1, 0, -1, 0, 0];
const R180 = [-1, 0, 0, 0, 1, 0, 0, 0, -1];
const R270 = [0, 0, -1, 0, 1, 0, 1, 0, 0];
const ENGINE_ROT = { 0: R0, 90: R270, 180: R180, 270: R90 };
const QUARTER = [0, 0, -1, 0, 1, 0, 1, 0, 0];
const SLOPE_CENTER_RAW = [0, 0, -10];

const RECT_FAMILIES = new Set(["brick", "plate", "tile"]);
const SLOPE45 = new Set(
  (catalog?.parts || []).filter((p) => p.family === "slope45").map((p) => p.id)
);
const TRANSPOSED = new Set(
  (catalog?.parts || [])
    .filter((p) => RECT_FAMILIES.has(p.family) && p.w !== p.d)
    .map((p) => p.id)
);

const matmul = (a, b) => {
  const out = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j];
      out[3 * i + j] = s;
    }
  return out;
};
const matvec = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

function partTransform(part, rot) {
  const rotm = ENGINE_ROT[(((rot || 0) % 360) + 360) % 360] || R0;
  if (SLOPE45.has(part)) {
    const m = matmul(rotm, QUARTER);
    return { m, off: matvec(m, SLOPE_CENTER_RAW) };
  }
  if (TRANSPOSED.has(part)) return { m: matmul(rotm, QUARTER), off: [0, 0, 0] };
  return { m: rotm, off: [0, 0, 0] };
}

export function toLdraw(brickModel, title = "lEgoarCh model") {
  const lines = [`0 ${title}`, "0 Name: model.ldr", "0 Author: lEgoarCh", ""];
  for (const b of brickModel.bricks) {
    const w = b.w || 1, d = b.d || 1, h = b.h || 3;
    const { m, off } = partTransform(b.part, b.rot || 0);
    const lx = Math.round((b.x + (w - 1) / 2) * LDU_PER_STUD - off[0]);
    const ly = -(b.z + h - 3) * LDU_PER_PLATE; // LDraw Y is down
    const lz = Math.round((b.y + (d - 1) / 2) * LDU_PER_STUD - off[2]);
    lines.push(`1 ${b.color} ${lx} ${ly} ${lz} ${m.join(" ")} ${b.part}.dat`);
  }
  return lines.join("\n") + "\n";
}

export function download(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function partsToCsv(parts) {
  const rows = [["part", "color_code", "color_name", "qty"]];
  for (const p of parts) rows.push([p.part, p.color, p.name, p.qty]);
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}
