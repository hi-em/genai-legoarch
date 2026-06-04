import { Sparkles, Box, Blocks, LibraryBig, Shapes } from "lucide-react";

// The world plane is a fixed CSS-px coordinate space. Zones are placed on it;
// the three build zones form a left->right assembly line, Shelf is the catalog
// at the end, Playground is a sandbox off to the side.
export const WORLD_W = 4040;
export const WORLD_H = 1720;

export const ZONES = [
  { id: "playground", label: "Playground", short: "Play",       icon: Shapes,     x: 120,  y: 980, w: 620, h: 560, kind: "side",    blurb: "Sandbox — restyle, recolor, mashup" },
  { id: "generate",   label: "Generate",   short: "Generate",   icon: Sparkles,   x: 900,  y: 360, w: 560, h: 640, kind: "build", step: 1, blurb: "Name a building" },
  { id: "viewer",     label: "3D · Print", short: "3D · Print", icon: Box,        x: 1620, y: 360, w: 640, h: 640, kind: "build", step: 2, blurb: "Smooth mesh & print" },
  { id: "studio",     label: "Brick Studio", short: "Studio",   icon: Blocks,     x: 2480, y: 300, w: 680, h: 720, kind: "build", step: 3, blurb: "Buildable bricks & parts" },
  { id: "shelf",      label: "My Shelf",   short: "Shelf",      icon: LibraryBig, x: 3340, y: 380, w: 560, h: 620, kind: "catalog", blurb: "Your saved collection" },
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));
export const BUILD_ZONES = ZONES.filter((z) => z.kind === "build");

export const center = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });
