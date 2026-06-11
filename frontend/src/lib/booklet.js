// Generate a LEGO-manual-style instruction booklet (PDF) from a brick model.
// Each build step = one more course (z-layer); the new layer is highlighted, the
// rest muted — exactly the real-manual convention. Reuses the z-layer grouping
// that also drives the assembly animation.
import { jsPDF } from "jspdf";
import { isoStepThumb } from "./isoThumb.js";
import { byCode } from "./palette.js";
import { courseOf, courseCount } from "./brickModel.js";

const INK = [32, 38, 43];
const MUTED = [110, 118, 112];

function partsAddedAt(bm, course) {
  const acc = {};
  for (const b of bm.bricks) {
    if (courseOf(b) !== course) continue;
    const k = `${b.part}|${b.color}`;
    acc[k] = (acc[k] || 0) + 1;
  }
  return Object.entries(acc).map(([k, qty]) => {
    const [part, code] = k.split("|");
    const c = Number(code);
    return { part, qty, name: byCode[c]?.name || `#${c}`, hex: byCode[c]?.hex || "#ccc" };
  });
}

export function generateBooklet(bm, setCopy = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const nCourses = courseCount(bm);              // build steps = brick courses
  const nBricks = bm.bricks.length;
  const name = setCopy.set_name || "Untitled Set";
  const number = setCopy.set_number || "";

  // ---- cover ----
  doc.setFillColor(20, 22, 20);
  doc.rect(0, 0, W, H, "F");
  doc.setTextColor(246, 199, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("lEgoarCh  ·  ARCHITECTURE", 48, 90);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(34);
  doc.text(name, 48, 140, { maxWidth: W - 96 });
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 205, 200);
  doc.text(`${nBricks.toLocaleString()} pieces · ${bm.grid[0]} × ${bm.grid[1]} studs · ${nCourses} courses${number ? ` · Set ${number}` : ""}`, 48, 172);
  // a big iso of the finished model
  const finished = isoStepThumb(bm, nCourses - 1, 560, "#1b1f1b");
  doc.addImage(finished, "PNG", (W - 360) / 2, 230, 360, 360);
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("Building Instructions", 48, H - 70);
  if (setCopy.designer_quote) {
    doc.setFontSize(9);
    doc.setTextColor(150, 155, 150);
    doc.text(doc.splitTextToSize(setCopy.designer_quote, W - 96), 48, H - 48);
  }

  // ---- steps: 4 per page (2x2) ----
  const perPage = 4, cols = 2;
  const cellW = (W - 96) / cols;
  const cellH = (H - 150) / 2;
  const thumbPx = 300;

  for (let z = 0; z < nCourses; z++) {
    const slot = z % perPage;
    if (slot === 0) {
      doc.addPage();
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(name, 48, 40);
      doc.text(`${z + 1}–${Math.min(nCourses, z + perPage)} / ${nCourses}`, W - 48, 40, { align: "right" });
    }
    const col = slot % cols, row = Math.floor(slot / cols);
    const cx = 48 + col * cellW;
    const cy = 64 + row * cellH;

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(String(z + 1), cx, cy + 6);

    const img = isoStepThumb(bm, z, thumbPx);
    const size = Math.min(cellW - 20, cellH - 80);
    doc.addImage(img, "PNG", cx, cy + 16, size, size);

    // parts-for-this-step strip
    const added = partsAddedAt(bm, z);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let ty = cy + 28 + size;
    const total = added.reduce((n, p) => n + p.qty, 0);
    doc.setTextColor(...MUTED);
    doc.text(`+${total} pcs`, cx, ty);
    let tx = cx + 42;
    for (const p of added.slice(0, 6)) {
      const rgb = hexToRgb(p.hex);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(tx, ty - 7, 8, 8, "F");
      doc.setTextColor(...INK);
      doc.text(`${p.qty}×`, tx + 11, ty);
      tx += 34;
    }
  }

  doc.save(`${name.replace(/[^\w]+/g, "_")}_instructions.pdf`);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
