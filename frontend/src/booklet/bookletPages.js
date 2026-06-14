// Single page-model source of truth for the instruction booklet — consumed by
// the in-app flip view AND its PDF export (both in BookletView.jsx — the PDF is
// produced by snapshotting the rendered spreads), so the two can never drift. A
// build step = one course (z-layer): the new layer is highlighted, prior courses
// muted (the real LEGO-manual convention). `partsAddedAt` is shared from here.
import { byCode } from "../lib/palette.js";
import { courseOf, courseCount } from "../lib/brickModel.js";

// The parts (part + colour, with quantity, name and swatch hex) introduced at a
// given course. Identical logic to the old private helper in lib/booklet.js so
// the PDF parts strip is unchanged.
export function partsAddedAt(bm, course) {
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

// Build the full page model: a cover descriptor plus one step per course. The
// flip view renders one course per page (bigger); the PDF lays them out 4-up.
// Both walk the same `steps` array so step N means the same thing everywhere.
export function buildBookletPages(bm, setCopy) {
  const sc = setCopy || {};   // setCopy can be null (offline / dev sample), not just undefined
  const nCourses = courseCount(bm);
  const nBricks = bm.bricks.length;

  const cover = {
    name: sc.set_name || "Untitled Set",
    number: sc.set_number || "",
    quote: sc.designer_quote || "",
    nBricks,
    nCourses,
    grid: bm.grid,
  };

  const steps = [];
  for (let z = 0; z < nCourses; z++) {
    const parts = partsAddedAt(bm, z);
    steps.push({
      course: z,
      parts,
      total: parts.reduce((n, p) => n + p.qty, 0),
    });
  }

  return { cover, steps };
}
