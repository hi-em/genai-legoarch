// Rough BrickLink-style price ESTIMATE (USD, used-condition averages). Not live
// data — a believable lower bound so the buildable fantasy has a number on it.
// For real prices we link out to BrickLink (OAuth + CORS make live calls a
// backend job; see docs).

// avg used price per part by BrickLink id
const PART_PRICE = {
  "3005": 0.04, // 1x1
  "3004": 0.05, // 1x2
  "3622": 0.07, // 1x3
  "3010": 0.09, // 1x4
  "3003": 0.07, // 2x2
  "3002": 0.10, // 2x3
  "3001": 0.12, // 2x4
};
const DEFAULT_PRICE = 0.08;

// scarcer colours cost more; transparent + a few are pricier
const COLOR_MULT = { 47: 1.6, 46: 1.7 }; // trans clear / trans yellow
const DEFAULT_MULT = 1.0;

export function unitPrice(part, color) {
  return (PART_PRICE[part] ?? DEFAULT_PRICE) * (COLOR_MULT[color] ?? DEFAULT_MULT);
}

// parts: [{ part, color, qty }]
export function estimateCost(parts) {
  if (!parts?.length) return { total: 0, lines: [] };
  const lines = parts.map((p) => ({ ...p, lineCost: unitPrice(p.part, p.color) * p.qty }));
  const total = lines.reduce((n, l) => n + l.lineCost, 0);
  return { total, lines };
}

export const fmtUSD = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// a wanted-list-ish BrickLink URL (search by the set name; real WL upload is a
// backend/OAuth job — this gets the user into the right place to price it).
export function bricklinkSearchUrl(setName) {
  return `https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(setName || "lego architecture")}`;
}
