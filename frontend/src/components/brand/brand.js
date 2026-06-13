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

/**
 * Paint the "Plate Stack" logo mark — three offset plates (one per stage) + a
 * stud — in a size×size box whose top-left is (x, y). Pixel-for-pixel the same
 * geometry as components/brand/LogoMark.jsx (64-unit viewBox), so the box and
 * shelf dioramas carry exactly the mark used in the app chrome. `mono` paints
 * the whole stack in `color` for single-colour contexts.
 */
export function drawLogoMark(ctx, x, y, size, { mono = false, color = "#ffffff" } = {}) {
  const s = size / 64;
  const C = mono
    ? { base: color, mid: color, top: color }
    : { base: BRAND_HEX.blue, mid: BRAND_HEX.red, top: BRAND_HEX.yellow };
  const plate = (px, py, w, h, r, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + px * s, y + py * s, w * s, h * s, r * s);
    ctx.fill();
  };
  plate(8, 44, 48, 13, 3, C.base);   // base plate (blue)
  plate(14, 30, 40, 13, 3, C.mid);   // mid plate (red)
  plate(20, 16, 30, 13, 3, C.top);   // top plate (yellow)
  plate(30, 9, 10, 8, 2.5, C.top);   // stud
  ctx.save();
  ctx.globalAlpha = 0.22;
  plate(30, 9, 10, 3, 1.5, "#ffffff"); // stud highlight
  ctx.restore();
}
