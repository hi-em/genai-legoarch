// LEGO color palette (subset). `code` = LDraw color id, `hex` for rendering.
// The rigorous CIEDE2000 matching lives in the Python backend; here we use a
// fast RGB-euclidean nearest for the in-browser mock.
export const PALETTE = [
  { code: 15, name: "White", hex: "#f4f4f2" },
  { code: 151, name: "Light Bluish Gray", hex: "#a0a5a9" },
  { code: 71, name: "Light Gray", hex: "#a3a2a5" },
  { code: 72, name: "Dark Bluish Gray", hex: "#635f62" },
  { code: 0, name: "Black", hex: "#1b2a34" },
  { code: 19, name: "Tan", hex: "#e4cd9e" },
  { code: 4, name: "Red", hex: "#c91a09" },
  { code: 14, name: "Yellow", hex: "#f2cd37" },
  { code: 1, name: "Blue", hex: "#1e5aa8" },
  { code: 2, name: "Green", hex: "#58ab41" },
  { code: 47, name: "Trans Clear", hex: "#fcfcfc" },
  { code: 46, name: "Trans Yellow", hex: "#f5cd2f" },
];

export const byCode = Object.fromEntries(PALETTE.map((c) => [c.code, c]));

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const PAL_RGB = PALETTE.map((c) => hexToRgb(c.hex));

export function nearestLegoColor(rgb) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PAL_RGB.length; i++) {
    const [r, g, b] = PAL_RGB[i];
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return PALETTE[best].code;
}
