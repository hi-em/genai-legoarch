// Regression coverage for the shelf display policy. The bug: the old 12k budget
// returned "box-only" for every high-detail flagship, so the shelf showed the
// retail box with no build in front; an empty/malformed model fell into "model"
// and rendered nothing at all. Both must resolve cleanly now.
import { describe, it, expect, vi } from "vitest";

// shelfLayout pulls worldHeight from bricks3d.jsx (→ @react-three/drei). Stub it
// so the pure display-policy function is testable without the WebGL stack.
vi.mock("../viewer/bricks3d.jsx", () => ({ worldHeight: (nz) => nz }));

import {
  displayModeFor, MODEL_BRICK_BUDGET,
  sizeFrac, boxScaleFor, modelScaleFrac, BOX_SCALE_MIN, BOX_SCALE_MAX,
} from "./shelfLayout.js";

const bm = (n) => ({ bricks: { length: n } });

describe("displayModeFor", () => {
  it("shows the box only for a missing or empty model (never a phantom 'model')", () => {
    expect(displayModeFor(null)).toBe("box-only");
    expect(displayModeFor({})).toBe("box-only");
    expect(displayModeFor({ bricks: [] })).toBe("box-only");
    expect(displayModeFor({ bricks: null })).toBe("box-only");
  });

  it("shows the model at or below the budget", () => {
    expect(displayModeFor(bm(1))).toBe("model");
    expect(displayModeFor(bm(MODEL_BRICK_BUDGET))).toBe("model");
  });

  it("falls back to the hero box only above the budget", () => {
    expect(displayModeFor(bm(MODEL_BRICK_BUDGET + 1))).toBe("box-only");
  });

  it("renders the detail-48 flagships the old 12k cap silently hid", () => {
    // Sagrada 15,089 · Bilbao 16,370 · Muralla 21,675 (docs/benchmarks.md §7)
    for (const n of [15089, 16370, 21675]) {
      expect(displayModeFor(bm(n))).toBe("model");
    }
  });
});

describe("size ∝ set — box + model scale with piece count", () => {
  it("the biggest set on the shelf gets the full size weight (1)", () => {
    expect(sizeFrac(21675, 21675)).toBe(1);
    expect(sizeFrac(5000, 5000)).toBe(1);   // a lone set is its own max
  });

  it("a smaller set scales down, never up", () => {
    const small = sizeFrac(3000, 21675);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(1);
    // monotonic: more pieces → larger weight against the same max
    expect(sizeFrac(15089, 21675)).toBeGreaterThan(sizeFrac(3000, 21675));
  });

  it("guards bad inputs (0 / missing) without NaN or blowing up", () => {
    expect(sizeFrac(0, 21675)).toBeGreaterThan(0);     // floored to 1 brick
    expect(sizeFrac(5000, 0)).toBe(1);                 // max floored to the set itself
    expect(Number.isFinite(sizeFrac(undefined, undefined))).toBe(true);
  });

  it("box scale stays within [MIN, MAX] so big cartons still fit the cell", () => {
    expect(boxScaleFor(0)).toBeCloseTo(BOX_SCALE_MIN);
    expect(boxScaleFor(1)).toBeCloseTo(BOX_SCALE_MAX);
    expect(boxScaleFor(0.5)).toBeGreaterThan(BOX_SCALE_MIN);
    expect(boxScaleFor(0.5)).toBeLessThan(BOX_SCALE_MAX);
  });

  it("model weight keeps a floor (never shrinks to a speck) and tops out at 1", () => {
    expect(modelScaleFrac(0)).toBeCloseTo(0.7);
    expect(modelScaleFrac(1)).toBeCloseTo(1);
  });
});
