// Regression coverage for the BrickModel adapter + normalizer. These are the
// pure functions behind the shelf's "model shows / box only" decision and the
// localStorage round-trip; a malformed or stripped model here is what silently
// left the box on the shelf with no build in front.
import { describe, it, expect } from "vitest";
import {
  adaptBrickModel,
  normalizeAdapted,
  PLATES_PER_COURSE,
  totalColors,
  partTypes,
} from "./brickModel.js";

// Current (plate) schema, as the backend returns it today.
const rawPlate = {
  z_unit: "plate",
  grid: [4, 4, 6],
  unit_mm: 8,
  plate_mm: 3.2,
  bricks: [
    { part: "3002", x: 0, y: 0, z: 0, color: 72, rot: 90, w: 3, d: 2, h: 3 },
    { part: "3005", x: 1, y: 1, z: 3, color: 72, rot: 0, w: 1, d: 1, h: 3 },
  ],
  stability: { connected: true, n_components: 1, support_ratio: 0.95, n_bricks: 2, unsupported_layers: [] },
};

// Legacy schema: z counts brick COURSES, no `h`, no z_unit.
const rawLegacy = {
  grid: [4, 4, 2],
  bricks: [
    { part: "3002", x: 0, y: 0, z: 0, color: 1, rot: 0 },
    { part: "3002", x: 0, y: 0, z: 1, color: 1, rot: 0 },
  ],
  stability: { connected: true },
};

describe("adaptBrickModel", () => {
  it("returns null when there are no bricks to render", () => {
    expect(adaptBrickModel(null)).toBe(null);
    expect(adaptBrickModel({ grid: [1, 1, 1] })).toBe(null);
  });

  it("attaches display hex, builds a grouped parts list, camelCases stability", () => {
    const bm = adaptBrickModel(rawPlate);
    expect(bm.bricks).toHaveLength(2);
    for (const b of bm.bricks) {
      expect(typeof b.hex).toBe("string");
      expect(b.hex.startsWith("#")).toBe(true);
    }
    // same colour, two part ids -> two parts rows
    expect(bm.parts).toHaveLength(2);
    expect(totalColors(bm)).toBe(1);
    expect(partTypes(bm)).toBe(2);
    expect(bm.stability.nBricks).toBe(2);
    expect(bm.stability.connected).toBe(true);
    expect(bm.stability.supportRatio).toBeCloseTo(0.95);
  });

  it("converts a legacy course-based model to the plate schema", () => {
    const bm = adaptBrickModel(rawLegacy);
    expect(bm.grid[2]).toBe(2 * PLATES_PER_COURSE);
    for (const b of bm.bricks) expect(b.h).toBe(PLATES_PER_COURSE);
    expect(bm.bricks[1].z).toBe(1 * PLATES_PER_COURSE);
  });

  it("survives a localStorage JSON round-trip with every brick field intact", () => {
    const bm = adaptBrickModel(rawPlate);
    const round = JSON.parse(JSON.stringify(bm));
    const keys = ["part", "x", "y", "z", "color", "rot", "w", "d", "h", "hex"];
    expect(round.bricks).toHaveLength(bm.bricks.length);
    for (let i = 0; i < bm.bricks.length; i++) {
      for (const k of keys) expect(round.bricks[i][k]).toEqual(bm.bricks[i][k]);
    }
    expect(round.grid).toEqual(bm.grid);
    expect(round.stability.nBricks).toBe(bm.stability.nBricks);
  });
});

describe("normalizeAdapted", () => {
  it("is a no-op (same reference) on a current model that already carries h", () => {
    const bm = adaptBrickModel(rawPlate);
    expect(normalizeAdapted(bm)).toBe(bm);
  });

  it("upgrades an already-adapted legacy set that lacks h / counts courses", () => {
    const legacyAdapted = {
      grid: [4, 4, 2],
      bricks: [{ part: "3002", x: 0, y: 0, z: 1, color: 1, rot: 0, w: 1, d: 1, hex: "#b40000" }],
    };
    const up = normalizeAdapted(legacyAdapted);
    expect(up).not.toBe(legacyAdapted);
    expect(up.grid[2]).toBe(2 * PLATES_PER_COURSE);
    expect(up.bricks[0].h).toBe(PLATES_PER_COURSE);
    expect(up.bricks[0].z).toBe(1 * PLATES_PER_COURSE);
  });

  it("returns empty / falsy models unchanged (nothing to upgrade)", () => {
    expect(normalizeAdapted(null)).toBe(null);
    const empty = { grid: [1, 1, 1], bricks: [] };
    expect(normalizeAdapted(empty)).toBe(empty);
  });
});
