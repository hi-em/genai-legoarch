# lEgoarCh — final presentation kit

Everything to record a single **sub‑5:00** video for the Generative‑AI course, plus the deck.

## Files
| File | What it is |
|---|---|
| `slide-script.md` | **A.** Speaker script — Act 1 narration (no slides) + Act 2 per‑slide words, timed, conversational. |
| `demo-script.md` | **B.** Act 1 click‑by‑click runbook (Saint Basil's), speed‑ramp markers, fallbacks. |
| `app-setup-checklist.md` | **C.** Prep before recording (servers, pre‑bake shelf, pin seed, clean surface). |
| `legoarch-deck.pdf` | **D.** Deck for viewing / submission — **9 slides**, 16:9. |
| `legoarch-deck.pptx` | **D.** Editable deck for PowerPoint / **Canva** (designed art as the slide background, all copy as live text boxes; notes embedded). |
| `build_deck.py` | **E.** Re‑runnable build script — one layout spec → both PDF and PPTX. |
| `design-system.md` | The "Studwork" visual language (emblem, plates, studs, colour rules, diagram patterns). |
| `fonts/` | Archivo + Inter TTFs. · `_slides/` | render artifacts (slide + bg PNGs). |

## Rebuild
```
python presentation/build_deck.py
```
Deps: `python-pptx`, `reportlab`, `Pillow`. Edit copy/layout in `build_deck.py` (`build_slides()`),
or just tweak words directly in Canva — the `.pptx` text boxes are live, in Archivo/Inter.

## The 9 slides (Act 1 is live — no slides)
1 title · 2 pipeline · 3 prompt engineering · 4 colour denoise · 5 the honest boundary (Bilbao) ·
6 reproducible · 7 scale + catalog · 8 contact‑sheet ending · 9 end card.

Timeline: cold open 0:00–0:20 (Emilie, slide 1 holds) · **Act 1 demo 0:20–1:50 (Emilie, live recording, no slides)** ·
Act 2 1:50–4:20 (Charles, slides 2–7) · close 4:20–4:40 (both, slides 8–9). **≈ 4:40.**

## Design language
Adopts the app: dark felt, light "plates," the **plate‑stack emblem** + **colored wordmark** on every slide,
stud/arrow motifs, colour‑coded stages (blue = generative · yellow = compute · red = catalog).
Fonts **Archivo + Inter** (both Canva‑free). Native diagrams/icons/arrows — no pasted‑figure‑as‑slide.
See `design-system.md`.

## Honesty / defensibility
- Demo = **Saint Basil's Cathedral** (live experience); its reveal numbers are read **live** (not benchmarked — don't quote the trio's stats for it).
- The benchmarked trio (Sagrada / Muralla / Bilbao) carry Act 2's data + figures and are pre‑baked on the shelf.
- Every number traces to `docs/benchmarks.md` (source line refs at the end of `slide-script.md`). Model = FLUX.2 Klein + legoarch LoRA → TRELLIS, never SDXL.
- The contact‑sheet ending uses real mesh/build screenshots; box/booklet/parts/shelf are **placeholders** — drop real screenshots into those cards in Canva.
