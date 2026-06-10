// Normalize the backend BrickModel into the shape the UI renders. The backend
// (Python legolizer) is the single source of truth for the brick layout; here
// we only attach display hex, build a colour-aware parts list, and convert the
// snake_case stability keys to the camelCase the components expect.
import { byCode } from "./palette.js";

const hexOf = (code) => byCode[code]?.hex || "#cccccc";
const nameOf = (code) => byCode[code]?.name || `Color ${code}`;

export function adaptBrickModel(raw) {
  if (!raw || !raw.bricks) return null;

  const bricks = raw.bricks.map((b) => ({
    part: b.part,
    x: b.x, y: b.y, z: b.z,
    color: b.color,
    rot: b.rot || 0,
    w: b.w || 1,
    d: b.d || 1,
    hex: hexOf(b.color),
  }));

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
  };

  return { grid: raw.grid, unit_mm: raw.unit_mm ?? 8, bricks, parts, stability };
}

export const totalParts = (bm) => bm?.parts?.reduce((n, p) => n + p.qty, 0) ?? 0;
export const totalColors = (bm) =>
  bm?.bricks ? new Set(bm.bricks.map((b) => b.color)).size : 0;
export const partTypes = (bm) =>
  bm?.bricks ? new Set(bm.bricks.map((b) => b.part)).size : 0;
