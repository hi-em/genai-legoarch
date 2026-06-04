# Concept — BrickForge

## The problem we started from
We trained `legoarch`, a FLUX.2 LoRA that renders famous buildings as LEGO-Architecture sets, and built a TRELLIS-2 image→3D ComfyUI workflow. The obvious idea — *photo → LEGO render → 3D → 3D-print* — has a real flaw: a printed TRELLIS mesh is a **smooth blob**. It has no studs, no discrete bricks, and isn't buildable. It loses the LEGO feel.

## The reframe
Instead of treating the smooth mesh as the only output, we make it **one of two exits**, and let the user decide how far to go:

- **Exit 1 — Print it.** Download the STL and 3D-print a smooth display souvenir. Fast, fun, low-commitment.
- **Exit 2 — Build it.** Run our **custom legolizer** to convert the model into legal, discrete, buildable bricks: an LDraw file, a real parts list, and step-by-step instructions. This is the genuine "LEGO Architecture" experience.

The original weakness becomes a **feature/UX choice**, and the project's center of gravity moves to the part nobody has done well: turning a generated building into something *buildable*.

## Why this is novel (and defensible to faculty)
- A prior MaCAD project ("LEGO Set: A Generative AI Approach", 2023-24) produced **images + marketing text only** — no 3D, no parts, nothing buildable. We start exactly where they stopped.
- "AI proposes, a solver disposes": the generative model invents the form; a **deterministic, verifiable legolizer** turns it into legal bricks. That answers the critique that generative AI is "just imitation" — the buildable structure is new and checkable.
- We deliberately do **not** just wrap BrickLink Studio's off-the-shelf "Sculpture" mesh→bricks button; our own legolizer (voxel grid → legal brick layout → color → connectivity/stability → LDraw) is the computational contribution.

## The fun layer (this is a studio project, not just a tool)
- **LEGO skin**: baseplate canvas, brick-shaped buttons, snap sounds, a minifig mascot guide.
- **Collection shelf**: every building you make lands on your own display shelf — a growing gallery of your creations (we're collectors; this is the heart of the "fun").
- **Playground** (nice-to-have): mash two buildings together, a restyle slider across architectural eras, **generate a sectional axonometric of a detail**, drag-to-recolor bricks.
- **Make-it-stand mini-game** (stretch): tilt the model, watch unstable bricks glow red and wobble.

## Inputs & outputs (plain)
- **Input:** a building photo (upload) or just its name (text prompt).
- **Output:** a LEGO-style image → a 3D model (STL, Exit 1) → a buildable brick set (LDraw + parts list + instructions, Exit 2), saved to your shelf.
