// JS mirror of the design tokens for code that can't read CSS classes —
// Three.js materials (viewer background, baseplate greens) and palette sync.
// Keep these in lockstep with src/styles/tokens.css.
export const COLORS = {
  surface: "#f4f5f2",
  elevated: "#ffffff",
  sunken: "#e7e9e4",
  ink: "#20262b",
  table: "#000000",
  brandRed: "#c91a09",
  brandYellow: "#f6c700",
  brandBlue: "#1e5aa8",
};

// 3D viewer canvas backdrop (a soft daylight gradient inside the light plate).
export const VIEWER_BG = "linear-gradient(#eef3f7,#d7dee5)";

// The studded baseplate the model rests on — muted green so it reads "premium
// set on a table", not "toy bin".
export const BASEPLATE = {
  edge: "#4e6743",
  top: "#6f8a5f",
  stud: "#7c9669",
};

// Monochrome stand-in brick color (used in the 3D·Print preview).
export const MONO_BRICK = "#cfd2d1";
