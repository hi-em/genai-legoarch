# lEgoarCh frontend

React + Vite + three.js (react-three-fiber) + Zustand + Framer Motion + Tailwind + Radix.

## Setup
```bash
npm install
npm run dev          # http://localhost:5173  (proxies /api -> http://127.0.0.1:8000)
```
The app needs the backend (and ComfyUI) running — it renders the real brick layout the backend returns, with no mock geometry. A DEV-only "Preview the assembly" button on the intro loads one bundled real sample so the UI can be exercised without a GPU.

## Structure
- `src/App.jsx` — switches between the two views (`useView`): the hero create flow and the collection.
- `src/hero/HeroFlow.jsx` — the cinematic flow: **type → render → assemble → reveal**.
  - `src/hero/examples.js` — full rich example prompts (LEGO-Architecture structure).
  - `src/hero/Collection.jsx` — saved-set grid + per-set detail (3D + trophies + LDraw/CSV).
  - `src/hero/trophies/` — `TheBox` · `ShareCard` · `PricedSet` (+ `TrophyShell`, `downloadImage`).
- `src/viewer/` — `BrickViewer` (static), `AssemblyViewer` (course-by-course), `bricks3d` (shared footprint instancing).
- `src/lib/` — `brickModel` (adapts the backend model + colour-aware parts), `booklet` (PDF) + `isoThumb`, `pricing`, `ldraw`, `thumb`, `image`, `sound`, `palette`, `tokens`, `motion`.
- `src/api.js` — `generate`, `generate3D`, `getSetCopy` (all hit the backend).
- `src/state/store.js` — Zustand: `useBuild`, `useCollection` (persisted, quota-safe), `useView`, `useUI` (mute).
- `src/components/ui/` — the lean primitive kit (Button, Chip, Textarea, StatTile, StudLoader, Tooltip, Toast).

Design system: tokens in `src/styles/tokens.css` + `tailwind.config.js` (see [`../docs/design-system.md`](../docs/design-system.md)).
