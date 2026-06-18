# lEgoarCh — speaker script

**≈ 4:40 · hard cap < 5:00 · two live speakers, no AI voiceover. Tone: conversational, humble — a maker showing their workbench.**

Demo building = **Saint Basil's Cathedral** (live). Model on screen = **FLUX.2 Klein 4B + `legoarch` LoRA → TRELLIS.2‑4B** (never "SDXL").

The deck has **9 slides**. **Act 1 has no slides** — it's a live screen recording; the title slide (1) just holds during the cold open. Act 2 is slides 2–7; the close is slides 8–9. Full click path is in `demo-script.md`.

🟡 = hold the frame legible (the prompt/seed/model is graded data — don't speed‑ramp over it). ⏩ = speed‑ramp in edit with an honest caption.

---

## ACT 1 — LIVE DEMO (Emilie) · 0:00–1:50 · *no slides, screen recording*

### Cold open · 0:00–0:20  *(slide 1 holds, then cut to the app)*
> "Okay — watch this. I'm going to type one building…" *(types **Saint Basil's Cathedral**, clicks ✨ Visualize)* "…hit visualize, and it starts turning a sentence into something you could actually build." ⏩ *(smash‑cut to the finished box on the shelf)* "A real LEGO set. Let me show you the four minutes in between."

### Render + recipe · 0:20–0:50
> "So first it makes a picture. That's FLUX — an image model — with a little fine‑tune we trained on forty real LEGO Architecture sets, so everything comes out in that official‑set look." *(flip the recipe card)* 🟡 "And it keeps the recipe: the exact prompt, the seed — the number that lets you get the same thing again — and the model. Same recipe, same set."

### Materialize → legolize · 0:50–1:25
> "If we like it, we make it 3D. This step's called TRELLIS — it guesses the sides the photo can't see. It's genuinely slow, a few minutes on the GPU, so we sped it up here." ⏩ *(cut to mesh)* "Then the part with no AI at all: we legolize it. It gets chopped onto a grid, matched to real LEGO colours, and solved into actual bricks — that part takes seconds."

### Reveal + shelf · 1:25–1:50
> *(stats reveal — read the live numbers)* "And… there it is. About [N] pieces, [N] colours, [N] percent of it self‑supporting. We box it up, and it lands on the shelf next to the others." *(→ hand to Charles)*

---

## ACT 2 — BEHIND THE SCENES (Charles) · 1:50–4:20 · *slides 2–7*

### SLIDE 2 · Pipeline — "Three steps. One build." · 1:50–2:13
**On screen:** 5‑stage diagram (prompt → FLUX → TRELLIS → voxelize → brick solve), arrows through studs, colour‑coded.
> "So how does that actually work? Three steps, really. A model proposes the shape, plain old code proves you can build it, and a real parts catalogue makes it orderable. Anyone can generate a pretty picture — the part we're proud of is the back half, the code that makes sure the thing stands up."

### SLIDE 3 · Prompt engineering — "Getting the render right." · 2:13–2:46
**On screen:** A/B grid (winner ringed), tuning dial, 4 plates: steps 28 · guidance 5.0 · LoRA 1.0 · negative on.
> "Getting the render right took real fiddling. We swept one setting at a time on the same three buildings and kept the winner. Twenty‑eight steps — more was just slower. Guidance five. And the LoRA at full strength — turn it down and the studs literally fade away, which is where the whole LEGO look lives. The prompt itself is an eight‑part recipe that keeps the shape solid so it survives the 3D step."

### SLIDE 4 · Colour denoise — "Fewer bricks, same building." · 2:46–3:15
**On screen:** confetti squares → arrow → clean studded plate; hero "up to −46%".
> "Here's a fun one. The 3D model bakes in tiny colour speckle, and every single speck would become its own one‑by‑one brick — thousands of them. So we blur it onto the render's true colour first. That's up to forty‑six percent fewer pieces — cheaper, simpler to build — and nothing gets any wobblier."

### SLIDE 5 · The honest boundary — "And here's where it falls apart." · 3:15–3:45
**On screen:** smooth curve → voxel grid → wobbly blob (+ ⚠ + the real Bilbao build).
> "And — honestly — here's where it falls apart. Frank Gehry's Guggenheim is all smooth curves, and a voxel grid just can't hold a curve, so it builds as a blob. Not Bilbao. It still stands up fine — connected, ninety‑three percent supported — it's just not legible. We actually like that we know exactly where the method ends."

### SLIDE 6 · Reproducible — "Same prompt, same set." · 3:45–4:05
**On screen:** seed 1001 = seed 2002 → "same buildable set".
> "This one surprised us. Run the same prompt with a different seed and yes, the pieces come out different — but it's always a single, connected, recognizable set. So it's the method doing the work, not a lucky roll."

### SLIDE 7 · Scale + catalog — "Real parts. Three sizes." · 4:05–4:20
**On screen:** 48‑colour stud grid · 44 parts · 1,598 combos · scale bars 24/32/48.
> "And it's all real. Every piece is an actual BrickLink part — forty‑eight colours, fifteen‑hundred‑odd validated combinations. Plus one model gives you three sizes, from a little two‑thousand‑piece draft up to a twenty‑two‑thousand‑piece flagship."

---

## CLOSE — MAKER PAYOFF (Both) · slides 8–9 · 4:20–4:40

### SLIDE 8 · Contact sheet — "Everything you get."
**On screen:** 6 outputs (3D mesh · legolized build · boxed set · booklet · parts list · shelf; placeholders where no asset).
> **Charles:** "From a sentence—"  **Emilie:** "—to a set you can build." **Emilie:** "You get the 3D model, the build, a boxed set, an instruction booklet, and a real parts list with a price. An architect's idea ends up as a box on your table."

### SLIDE 9 · End card
**On screen:** emblem + colored wordmark + "From a sentence to a set you can build." + names.
> *(let it sit under the last line)*

---

## Timing & balance
| Segment | Slides | Time | Speaker |
|---|---|---|---|
| Cold open | 1 (holds) | 0:00–0:20 | Emilie |
| Act 1 demo | none (live) | 0:20–1:50 | Emilie |
| Act 2 | 2–7 | 1:50–4:20 | Charles |
| Close | 8–9 | 4:20–4:40 | Both |

**≈ 4:40.** Emilie ≈ 110 s · Charles ≈ 150 s · shared close. Optional rebalance: hand Slide 2 to Emilie and the closing payoff line to Charles for a closer 50/50.

## Numbers → source (defensibility)
FLUX.2 Klein + LoRA + TRELLIS `benchmarks.md:24–28` · winners 28/5.0/1.0/neg‑on `:67` · colour −19–46% no stability loss `:129–135` · Bilbao 93% / "blob not Bilbao" `:85–90` · seed 1001 vs 2002 `:189–204` · scale 24/32/48 `:169–173` · catalog 48/44/1,598 `:233–235` · thesis `README.md:14`. St Basil's reveal numbers are **read live** (not benchmarked — don't quote the trio's stats for it).
