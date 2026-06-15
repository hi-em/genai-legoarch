// Regression coverage for the shelf display policy. The bug: the old 12k budget
// returned "box-only" for every high-detail flagship, so the shelf showed the
// retail box with no build in front; an empty/malformed model fell into "model"
// and rendered nothing at all. Both must resolve cleanly now.
import { describe, it, expect, vi } from "vitest";

// shelfLayout pulls worldHeight from bricks3d.jsx (→ @react-three/drei). Stub it
// so the pure display-policy function is testable without the WebGL stack.
vi.mock("../viewer/bricks3d.jsx", () => ({ worldHeight: (nz) => nz }));

import { displayModeFor, MODEL_BRICK_BUDGET } from "./shelfLayout.js";

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
