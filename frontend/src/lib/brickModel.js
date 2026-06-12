// Normalize the backend BrickModel into the shape the UI renders. The backend
// (Python legolizer) is the single source of truth for the brick layout; here
// we only attach display hex, build a colour-aware parts list, and convert the
// snake_case stability keys to the camelCase the components expect.
//
// Grid convention (current schema, z_unit === "plate"): z is in PLATE layers
// (1 plate = 3.2 mm, 3 plates = 1 brick course) and each piece carries `h`,
// its height in plates. Legacy models (dev sample, old saved sets) used one
// z per brick course — the shim below converts them on the way in.
import { byCode } from "./palette.js";

const hexOf = (code) => byCode[code]?.hex || "#cccccc";
const nameOf = (code) => byCode[code]?.name || `Color ${code}`;

// studless tile parts (LDraw ids) — the renderer skips their studs
export const STUDLESS = new Set(["3070b", "3069b", "63864", "2431", "3068b", "87079"]);

export const PLATES_PER_COURSE = 3;
export const courseOf = (b) => Math.floor(b.z / PLATES_PER_COURSE);
export const courseCount = (bm) =>
  bm ? Math.ceil(bm.grid[2] / PLATES_PER_COURSE) : 0;

export function adaptBrickModel(raw) {
  if (!raw || !raw.bricks) return null;

  const legacy = raw.z_unit !== "plate";   // pre-plate schema: z in brick courses
  const bricks = raw.bricks.map((b) => ({
    part: b.part,
    x: b.x, y: b.y,
    z: legacy ? b.z * PLATES_PER_COURSE : b.z,
    color: b.color,
    rot: b.rot || 0,
    w: b.w || 1,
    d: b.d || 1,
    h: legacy ? PLATES_PER_COURSE : (b.h || 1),
    hex: hexOf(b.color),
  }));

  const grid = legacy
    ? [raw.grid[0], raw.grid[1], raw.grid[2] * PLATES_PER_COURSE]
    : raw.grid;

  // parts list grouped by part + colour so the swatches are correct
  const acc = {};
  for (const b of bricks) {
    const k = `${b.part}|${b.color}`;
    acc[k] = (acc[k] || 0) + 1;
  }
  const parts = Object.entries(acc)
    .map(([k, qty]) => {
      const [part, code] = k.split("|");
      const c = Number(code);
      return { part, color: c, name: nameOf(c), hex: hexOf(c), qty };
    })
    .sort((a, b) => b.qty - a.qty);

  const s = raw.stability || {};
  const stability = {
    connected: !!s.connected,
    components: s.n_components ?? s.components ?? 1,
    supportRatio: s.support_ratio ?? s.supportRatio ?? 1,
    nBricks: s.n_bricks ?? bricks.length,
    unsupportedLayers: s.unsupported_layers ?? [],
    // honest-repair stats (Testuz pillars) — surfaced, not silently dropped
    pillarsAdded: s.pillars_added ?? s.pillarsAdded ?? 0,
    componentsBefore: s.components_before ?? s.componentsBefore ?? null,
  };

  return {
    grid,
    unit_mm: raw.unit_mm ?? 8,
    plate_mm: raw.plate_mm ?? 3.2,
    bricks,
    parts,
    stability,
  };
}

// Upgrade an ALREADY-ADAPTED model from before the plate engine (old saved
// sets in the collection): bricks carry no `h` and z counts brick courses.
// Idempotent — current-format models pass through untouched.
export function normalizeAdapted(bm) {
  if (!bm || !bm.bricks?.length || bm.bricks[0].h != null) return bm;
  return {
    ...bm,
    plate_mm: 3.2,
    grid: [bm.grid[0], bm.grid[1], bm.grid[2] * PLATES_PER_COURSE],
    bricks: bm.bricks.map((b) => ({ ...b, z: b.z * PLATES_PER_COURSE, h: PLATES_PER_COURSE })),
  };
}

export const totalParts = (bm) => bm?.parts?.reduce((n, p) => n + p.qty, 0) ?? 0;
export const totalColors = (bm) =>
  bm?.bricks ? new Set(bm.bricks.map((b) => b.color)).size : 0;
export const partTypes = (bm) =>
  bm?.bricks ? new Set(bm.bricks.map((b) => b.part)).size : 0;
