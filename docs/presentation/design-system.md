# lEgoarCh deck — design system: "Studwork"

A visual philosophy for the deck, derived from the app itself.

## The movement
**Studwork.** Ideas built the way the app builds: modular, honest, snapped together plate by
plate on a dark felt table. Nothing floats; everything *sits* on a surface. Every claim is a
physical object you could pick up. Meticulously aligned to an 8-unit stud grid, flat as injection-
moulded plastic — no gradients, no shadows, no glow. The felt recedes; the colored plates carry the
meaning. Restraint is the craft: one idea per slide, one hero object, a whisper of type. The tone is
a maker showing you their workbench — humble, specific, a little surprised by what worked — never a
sales deck.

## Grid & safe zones (1920×1080 / 13.333×7.5in)
- Margin: **0.055** all sides. Nothing crosses it.
- **Header band** y 0.05–0.11: emblem + section label. Content never enters.
- **Title band** y 0.13–0.27: page title (Archivo).
- **Content band** y 0.30–0.88: the hero diagram / object. *(This hard split is what kills the old word/image overlap.)*
- **Footer band** y 0.92–0.96: hairline + emblem + colored wordmark + thesis tag + page no.

## Identity on every slide
- **Emblem** (plate stack): blue base → red mid → yellow top + yellow stud w/ white highlight. Exact 64-grid geometry. Header (small) + title/end (large).
- **Wordmark** "lEgoarCh": letters colored l·**E**(yellow)·go·**a**(red)·r·**C**(blue)·h on white. Art only (a logo, not editable copy).
- **Footer**: persistent, every content slide.

## Type scale (Archivo display / Inter body)
- Page title 40 · section label 15 (tracked caps) · plate title 21 · body 17–18 · gloss 14 · footer 12 · hero stat 54–64.
- Two weights only. Sentence case. Humble verbs ("we had to tune", "here's where it breaks").

## Color rules
- **Felt** #2b2f2c = ground. **Plates** #f4f5f2 / #fff = where content lives (dark ink type on plates).
- **Blue #1e5aa8 = generative** (FLUX/TRELLIS) · **Yellow #f6c700 = deterministic compute** (voxelize/legolize) · **Red #c91a09 = the real catalog / a flag/limit**. **Tan #e4cd9e** = quiet on-felt body. White = on-felt emphasis.
- Color is meaning, not decoration — tint a plate's top edge by its stage; keep everything else neutral.

## Motifs
- **Stud** = a small circle (often with a faint white highlight). Used as a bullet, a node arrows pass through, and the top accent of a plate.
- **Plate** = rounded rect (fillet ≈14px here), optional stud row on top. **Data callouts are plates** — a small tracked label + a big value, with a stud, so a number reads as a physical tile.
- **Arrows** route *through studs* between stages (snap = connection).

## Native diagrams (drawn, not pasted)
- **Pipeline**: 5 plates (prompt → FLUX → TRELLIS → voxelize+colour → brick), each with an icon + label + gloss, top edge tinted by stage color, arrows through studs.
- **Confetti → plate**: scatter of tiny colored squares → big arrow → one tidy studded plate. The −19–46% delta as the hero stat.
- **Curve → grid → blob**: smooth wave → wave under a voxel grid → wobbly grey blob with a small ⚠. The honest-limit beat.
- **Seed equation**: [die · seed 1001 · set] = [die · seed 2002 · set] → "same buildable set".
- **Stud-grid of 48**: 8×6 colored dots = the colour catalog; brick icon = parts; tile = combos.
- **Contact sheet**: 6 output plates (mesh · legolize · box · booklet · parts list · shelf), photos where they exist, icon placeholders where they don't.

## Icons (flat line glyphs, drawn in primitives, ink on plates)
prompt-bubble · image-frame · iso-cube (3D) · voxel-grid · brick(+studs) · tuning-dial · confetti ·
merged-plate · wave-curve · wobbly-blob · warning-triangle · die(seed) · equals · colour-dot ·
iso-box · booklet · parts-list · shelf. One stroke weight (~7% of icon box), one color per use.
