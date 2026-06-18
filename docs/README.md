# docs/

Narrative and reference documentation for lEgoarCh. Start with the root
[README](../README.md) for setup; come here for the *why* and the evidence.

## Read in this order

| Doc | What it covers |
|---|---|
| [concept.md](concept.md) | The thesis — generative form, deterministic buildability — and how it extends prior work |
| [architecture.md](architecture.md) | End-to-end data flow and the system diagram (prompt → FLUX → TRELLIS → legolizer → set) |
| [legolizer-research.md](legolizer-research.md) | Survey of legolization approaches; what we adopted vs. deferred |
| [research.md](research.md) | Algorithms and papers we reuse, plus planned upgrades |
| [benchmarks.md](benchmarks.md) | Method + results on three buildings (Sagrada / La Muralla / Bilbao) |
| [decisions-justified.md](decisions-justified.md) | Every claim traced to a benchmark figure or source line |
| [design-system.md](design-system.md) | App visual identity: tokens, brand, trademark-safe rules |
| [references.md](references.md) | Prior art (repos, tools) and how lEgoarCh differs |
| [plan.md](plan.md) | Roadmap and API contract |

## Subfolders

- **[blog/](blog/)** — the public narrative write-up
  ([legoarch-blog-post.md](blog/legoarch-blog-post.md)) and its `assets/`.
- **[adr/](adr/)** — architecture decision records
  ([0001 — the legolize engine](adr/0001-legolize-engine.md)).
- **[benchmarks/assets/](benchmarks/assets/)** — figures and example outputs
  referenced by `benchmarks.md` and `decisions-justified.md` (the `.glb` meshes
  are git-LFS).

> The deck and the team's "Studwork" deck design system live under
> [`presentation/`](presentation/).
