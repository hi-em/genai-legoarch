# presentation/ — deck + recording kit

Everything for the Generative-AI course submission: a short recorded demo, the
slides "behind the sets," and the program that builds the deck.

## What's here

| Path | What it is |
|---|---|
| `build_deck.py` | **The deck, as a program.** One fractional-layout spec → two synced backends: Pillow → `legoarch-deck.pdf`, python-pptx → `legoarch-deck.pptx` (designed art as the background, all copy as live, editable text boxes). |
| `design-system.md` | The **"Studwork"** visual language for the deck (warm dark "studio table", cream plates, colour = meaning: blue generative · yellow compute · red catalog). |
| `legoarch-deck-manual-updates.pdf` | **Canonical deck** — the hand-finished PDF used for submission. |
| `talk/` | The recording kit: speaker scripts, the demo runbook, the pre-record checklist, and the narration `.docx`. |
| `_icons/` · `fonts/*.ttf` · `brand/` · `images/` | Build **inputs** read by `build_deck.py` (Lucide SVGs, Nunito + DM Sans, brand marks, photos/screenshots incl. `images/views/`). |

## Rebuild the deck

```
python presentation/build_deck.py
```

Writes `legoarch-deck.pdf` + `legoarch-deck.pptx` here, plus the per-slide PNGs in
`_slides/` and PDF-static fonts in `fonts/_pdf/`. Deps are in
[`requirements.txt`](requirements.txt) (`Pillow`, `python-pptx`, `reportlab`,
`svglib` + `rlPyCairo` + `pycairo` for the icons, `fonttools` for per-glyph
fallback). It also reads benchmark figures from
[`../benchmarks/assets/examples/`](../benchmarks/assets/examples/).

> **Generated, not tracked.** `_slides/`, `fonts/_pdf/`, and the generated
> `legoarch-deck.pdf` / `.pptx` are git-ignored build output — re-run the script
> to recreate them. Edit copy/layout in `build_deck.py` (`build_slides()`), or
> tweak words directly in Canva (the `.pptx` text boxes are live).

## The talk

`talk/` holds the words and the runbook (see each file's header for its exact
role and timing):

- `slide-script.md` — speaker script for the slides.
- `script-2min.md` — the tight ~2-minute slide narration.
- `demo-script.md` — click-by-click runbook for the live demo.
- `app-setup-checklist.md` — prep before you hit record.
- `demo-narration-script.docx` — narration draft.

The recorded submission video is kept in the repo as
`S12_charles_emilie_legoarch.mp4` (git-LFS).

## Honesty / defensibility

The slides do **not** re-walk the recorded demo — they explain what's *behind the
sets*. Every benchmark number traces to [`../benchmarks.md`](../benchmarks.md);
the model is **FLUX.2 Klein + legoarch LoRA → TRELLIS**, never SDXL.
