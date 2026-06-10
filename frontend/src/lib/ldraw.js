// LDraw (.ldr) export — mirrors backend/app/legolizer/ldraw.py.
// Opens in BrickLink Studio / any LDraw viewer.
const LDU_PER_STUD = 20;
const LDU_PER_BRICK_H = 24;
const ROT0 = "1 0 0 0 1 0 0 0 1";
const ROT90 = "0 0 1 0 1 0 -1 0 0";

export function toLdraw(brickModel, title = "lEgoarCh model") {
  const lines = [`0 ${title}`, "0 Name: model.ldr", "0 Author: lEgoarCh", ""];
  for (const b of brickModel.bricks) {
    const w = b.w || 1, d = b.d || 1;
    // LDraw parts are centered on their footprint, so place at the footprint center
    const lx = Math.round((b.x + (w - 1) / 2) * LDU_PER_STUD);
    const ly = -b.z * LDU_PER_BRICK_H; // LDraw Y is down
    const lz = Math.round((b.y + (d - 1) / 2) * LDU_PER_STUD);
    const m = b.rot === 90 ? ROT90 : ROT0;
    lines.push(`1 ${b.color} ${lx} ${ly} ${lz} ${m} ${b.part}.dat`);
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
