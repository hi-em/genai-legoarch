# BrickForge frontend

React + Vite + three.js (react-three-fiber), LEGO-skinned.

## Setup
```bash
npm install
npm run dev          # http://localhost:5173  (proxies /api -> http://127.0.0.1:8000)
```

## Screens (map to milestones)
- `Generate` — photo/prompt → legoarch render (M0)
- `Viewer3D` — TRELLIS 3D + **download STL** (Exit 1) (M1)
- `BrickStudio` — custom legolizer: brick model + parts + instructions (Exit 2) (M2)
- `Shelf` — collection of your creations (M3)
- `Playground` — mashup / restyle / detail-axo / recolor (M4)

State in `src/state/store.js` (zustand). Design system (Tailwind + Radix + Framer Motion):
tokens in `src/styles/tokens.css` + `tailwind.config.js`, primitives in `src/components/ui/`.
The screens live inside an infinite-canvas "play-table" world in `src/canvas/` (with a
mobile `StepperFlow` fallback under 900px).
