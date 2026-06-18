# lEgoarCh — Demo runbook (Act 1 live walkthrough)

**Recorded + edited** (not one continuous take). Run the pipeline live; speed‑ramp the slow steps in
edit with an honest caption. Demo building = **Saint Basil's Cathedral**. Driver = **Emilie**.

> Record Act 1 in **re‑shootable segments** (cold open · render+recipe · materialize · legolize+reveal ·
> pack+shelf). If any segment fizzles, re‑shoot just that segment. The seed is pinned so re‑shoots match.

## Pre‑flight (must be true before you hit record)
- App open at `http://localhost:5173`, backend up on `:8000`. (See app‑setup‑checklist.md.)
- **Render model pre‑warmed** (one throwaway St Basil's generate already done this session → next render returns fast).
- **Seed pinned** in the render TinkerPanel (dice → fix a value; note it for re‑shoots).
- **Shelf pre‑loaded** with the 3 benchmark sets (Sagrada / Muralla / Bilbao) — verify on a hard refresh.
- Intro splash skipped or pre‑cleared; window framing + zoom locked; notifications off; sound on (for snap/chime).
- **Fallback ready:** if St Basil's shatters on the live forge (slim onion‑dome necks pinch off in
  voxelization), re‑prompt with a research‑safe building — **Taj Mahal / Himeji Castle / Great Pyramid**
  — or fall back to the dev‑sample reveal. Decide before recording, not mid‑take.

---

## SEGMENT 1 — Cold open (0:00–0:20)
1. Start on the prompt screen (heading *"Name a building. Get a buildable LEGO set."*).
2. **Type** exactly: `Saint Basil's Cathedral` (or click the **Saint Basil's Cathedral** example chip — it loads the full engineered prompt).
3. Click **✨ Visualize it**. Render starts.
4. **Speed‑ramp** the render in edit; **smash‑cut** to the finished St Basil's box already on the shelf.
- **Say:** "Watch this. I'll name a building — Saint Basil's Cathedral — hit visualize, and lEgoarCh turns a sentence into something you can actually build. Here's the four minutes in between."

## SEGMENT 2 — Render + recipe (0:20–0:50)
5. Back on the **render‑stop** screen, the RecipeCard shows the render. Click it to **flip to the recipe**.
6. 🟡 **HOLD this frame static + legible** (do not speed past it — it's the graded data):
   - the **prompt** (the 8‑slot grammar), the **seed**, and **model: FLUX.2 Klein 4B + legoarch LoRA**.
- **Say:** "First, the picture. A model called FLUX — with a LoRA we trained on forty real LEGO Architecture sets — renders it in the LEGO house style. And every result keeps its recipe: the exact prompt, the seed that makes it repeatable, and the model. Same recipe, same set, every time."

## SEGMENT 3 — Materialize in 3D (0:50–1:10)
7. Click **□ Materialize in 3D**.
8. This is the genuinely slow step (TRELLIS, ~minutes). **Speed‑ramp** with on‑screen caption:
   **"TRELLIS image‑to‑3D · ~5 min on the GPU, sped up."**
9. Cut to the rotating mesh in the MeshViewer; give it one slow orbit.
- **Say:** "Happy with it? We materialize it in three dimensions — TRELLIS rebuilds the sides the photo can't see. This part is slow, a few minutes on the GPU, so we've sped it up here."

## SEGMENT 4 — Legolize + reveal (1:10–1:35)
10. Click **✨ Legolize** (CPU, runs in seconds — keep this **live**, it's a great honest beat).
11. Watch the solver sprint → assembly drop → reveal.
12. 🟡 Hold the **stat tiles** legible. **Read the live numbers off the screen** (do not pre‑write them).
- **Say:** "Then the step with no AI at all — we legolize. The mesh gets voxelized, colour‑matched to real LEGO colours, and solved into actual bricks in seconds. And there it is — a buildable set: about [N] pieces, [N] colours, [N] percent self‑supporting."

## SEGMENT 5 — Pack + shelf (1:35–1:50)
13. Click **▶ Pack** → let the packing ritual play (~6 s).
14. Click **Go to shelf** → the 3 pre‑baked benchmark sets are there; St Basil's joins them.
- **Say:** "We pack it into a box, and it lands on the shelf, right next to the others." → hand to Charles.

---

## Edit map (what to speed‑ramp vs hold)
| Moment | Edit |
|---|---|
| Cold‑open render | ⏩ speed‑ramp → smash‑cut to box |
| Recipe card (prompt/seed/model) | 🟡 **hold 3–4 s, full‑res, legible** |
| Materialize / TRELLIS | ⏩ speed‑ramp + caption "~5 min on GPU, sped up" |
| Legolize + assembly | keep live / near‑real‑time (it's fast and looks great) |
| Stat reveal | 🟡 hold 2–3 s legible |
| Pack ritual | keep live (~6 s) |

## Hard rules
- Never speed‑ramp over the prompt/seed/model frame — that's the rubric's "surface the workflow data."
- Caption the slow cut honestly; no silent jump that looks like hiding a failure.
- If you swap the building via fallback, re‑record Segments 1–5 with the new name; everything else holds.
