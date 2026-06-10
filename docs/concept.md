# Concept — lEgoarCh

## The problem we started from
We trained `legoarch`, a FLUX.2 LoRA that renders famous buildings as LEGO-Architecture sets, and built a TRELLIS-2 image→3D ComfyUI workflow. The obvious idea — *photo → LEGO render → 3D → 3D-print* — has a real flaw: a printed TRELLIS mesh is a **smooth blob**. No studs, no discrete bricks, not buildable. It loses the LEGO feel.

## The reframe
We stopped treating the smooth mesh as the output and made it an **internal step**. The center of gravity moves to the part nobody has done well: turning a generated building into something genuinely **buildable**.

- The generative model invents the **form** (FLUX render → TRELLIS 3D).
- A deterministic, verifiable **legolizer** turns that form into legal, discrete bricks: real footprints, colours matched to the render, a connectivity/support check, and an LDraw file you could open in BrickLink Studio.

*"AI proposes, a solver disposes."* That answers the critique that generative AI is "just imitation" — the buildable structure is new and checkable.

## Why this is novel (and defensible to faculty)
- A prior MaCAD project ("LEGO Set: A Generative AI Approach", 2023-24) produced **images + marketing text only** — no 3D, no parts, nothing buildable. We start exactly where they stopped.
- We deliberately do **not** wrap BrickLink Studio's off-the-shelf "Sculpture" mesh→bricks button. Our own legolizer (voxel grid → legal split-and-merge layout → colour → connectivity/stability → LDraw) is the computational contribution. See [`adr/0001-legolize-engine.md`](adr/0001-legolize-engine.md).
- Evaluated with **buildability metrics** (% supported, single connected component, piece count), not FID/CLIP.

## The collector payoff (this is a studio project, not just a tool)
We're LEGO collectors, so the reward is the *product*, not a file dump. After a set is solved you watch it **assemble course-by-course** (with snap sounds), then get:
- **The Box** — official-style black Architecture box art (your render as cover, piece count, set number, designer quote).
- **Instruction booklet** — a step-by-step PDF, one course per step, in the real-manual aesthetic.
- **Priced set** — the parts list with a believable build-cost estimate, plus a link out to BrickLink for live pricing.
- **Share card** — a social card.
- **Collection shelf** — every set you make lands on a persistent shelf, reopenable with its 3D model and trophies.

A **"set designer" persona** names each set and writes the back-of-box copy in a dry catalogue voice (playful but credible — it never undercuts the engineering).

## Inputs & outputs (plain)
- **Input:** a building name, a full rich prompt, or a reference photo (→ img2img). The `legoarch` LoRA trigger is added for you.
- **Output:** a LEGO render → a colour-matched, buildable brick set → box art, an instruction PDF, a priced parts list, a share card, and an LDraw/CSV export — saved to your shelf.
