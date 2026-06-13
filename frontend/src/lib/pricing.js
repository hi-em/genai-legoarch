// Rough BrickLink-style price ESTIMATE (USD, used-condition averages). Not live
// data — a believable lower bound so the buildable fantasy has a number on it.
// For real prices we link out to BrickLink (OAuth + CORS make live calls a
// backend job; see docs).
import { byCode } from "./palette.js";

// avg used price per part by BrickLink id (tiles listed by LDraw id w/ suffix)
const PART_PRICE = {
  "3005": 0.04, // brick 1x1
  "3004": 0.05, // brick 1x2
  "3622": 0.07, // brick 1x3
  "3010": 0.09, // brick 1x4
  "3003": 0.07, // brick 2x2
  "3002": 0.10, // brick 2x3
  "3001": 0.12, // brick 2x4
  "3024": 0.03, // plate 1x1
  "3023": 0.04, // plate 1x2
  "3623": 0.05, // plate 1x3
  "3710": 0.06, // plate 1x4
  "3022": 0.06, // plate 2x2
  "3021": 0.08, // plate 2x3
  "3020": 0.09, // plate 2x4
  "3070b": 0.03, // tile 1x1
  "3069b": 0.04, // tile 1x2
  "3068b": 0.06, // tile 2x2
  // catalog-era additions (2026-06): long bricks/plates, new tiles, 45° slopes
  "3009": 0.14, // brick 1x6
  "3008": 0.22, // brick 1x8
  "2456": 0.18, // brick 2x6
  "3007": 0.30, // brick 2x8
  "3666": 0.07, // plate 1x6
  "3460": 0.10, // plate 1x8
  "3795": 0.10, // plate 2x6
  "3034": 0.12, // plate 2x8
  "63864": 0.06, // tile 1x3
  "2431": 0.07, // tile 1x4
  "87079": 0.10, // tile 2x4
  "3040b": 0.06, // slope 45 2x1
  "3039": 0.08, // slope 45 2x2
  "3038": 0.16, // slope 45 2x3
  "3037": 0.18, // slope 45 2x4
};
const DEFAULT_PRICE = 0.08;

// scarcer colours cost more; transparent + a few are pricier
const COLOR_MULT = { 47: 1.6, 46: 1.7 }; // trans clear / trans yellow
const DEFAULT_MULT = 1.0;

export function unitPrice(part, color) {
  return (PART_PRICE[part] ?? DEFAULT_PRICE) * (COLOR_MULT[color] ?? DEFAULT_MULT);
}

// parts: [{ part, color, qty, name?, hex? }]
// Every returned line is guaranteed to carry `hex` (swatch) and `name` (color
// label) by joining the color code against the palette — so callers that pass
// raw { part, color, qty } still render correct swatches.
export function estimateCost(parts) {
  if (!parts?.length) return { total: 0, lines: [] };
  const lines = parts.map((p) => {
    const c = byCode[p.color];
    return {
      ...p,
      name: p.name ?? c?.name ?? `Color ${p.color}`,
      hex: p.hex ?? c?.hex ?? "#888888",
      lineCost: unitPrice(p.part, p.color) * p.qty,
    };
  });
  const total = lines.reduce((n, l) => n + l.lineCost, 0);
  return { total, lines };
}

// Used-condition resale value of a built set — roughly what you'd recoup parting
// it out at typical used prices. Reused by the trophy/collection views.
const RESELL_FACTOR = 0.55;
export function resellEstimate(total) {
  return (total || 0) * RESELL_FACTOR;
}

export const fmtUSD = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// a wanted-list-ish BrickLink URL (search by the set name; real WL upload is a
// backend/OAuth job — this gets the user into the right place to price it).
export function bricklinkSearchUrl(setName) {
  return `https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(setName || "lego architecture")}`;
}
