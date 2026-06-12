// Single source of truth for the lEgoarCh wordmark: the letterform sequence,
// the brand hex map, and a canvas painter — every render of the wordmark
// (DOM via <Wordmark/>, canvas via drawWordmark) reads from here.

export const BRAND_HEX = { yellow: "#f6c700", red: "#c91a09", blue: "#1e5aa8" };

// The wordmark as segments: t = text, c = brand color key (null = base color).
export const WORDMARK = [
  { t: "l", c: null },
  { t: "E", c: "yellow" },
  { t: "go", c: null },
  { t: "a", c: "red" },
  { t: "r", c: null },
  { t: "C", c: "blue" },
  { t: "h", c: null },
];

const wordmarkFont = (px) => `900 ${px}px "DM Sans", system-ui, sans-serif`;

/** Width of the wordmark at `px` without drawing it (same font as drawWordmark). */
export function measureWordmark(ctx, px) {
  ctx.save();
  ctx.font = wordmarkFont(px);
  const w = ctx.measureText(WORDMARK.map((s) => s.t).join("")).width;
  ctx.restore();
  return w;
}

/**
 * Paint the wordmark on a canvas at (x, y) — x is the LEFT edge; the caller's
 * textBaseline is respected. Colored letters use BRAND_HEX, the rest use
 * `baseColor`. Returns the total painted width.
 */
export function drawWordmark(ctx, x, y, px, baseColor = "#ffffff") {
  ctx.save();
  ctx.font = wordmarkFont(px);
  ctx.textAlign = "left";
  let cx = x;
  for (const seg of WORDMARK) {
    ctx.fillStyle = seg.c ? BRAND_HEX[seg.c] : baseColor;
    ctx.fillText(seg.t, cx, y);
    cx += ctx.measureText(seg.t).width;
  }
  ctx.restore();
  return cx - x;
}
