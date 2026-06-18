# lEgoarCh — Slide Script (~2 min)

Conversational pace, humble tone. ~290 words. Pause on the slide changes.

---

**01 · Title**
Now here's what's happening behind the sets.

**02 · Why it matters**
Why bother? Three reasons. It's real bricks, not a render. It's something a client keeps, not foam they bin. And change the design, you only reorder what changed.

**03 · The system → 04 · The experience → 05 · The models → 06 · ComfyUI workflows**
Here's the whole pipeline — and what makes it interesting is that it's generative at every step. You don't draw anything. You describe a building, and two AI models do the imagining: FLUX hallucinates the image, TRELLIS carves it into a 3D mesh — filling in the back the photo can't see. We wrapped that in three small ComfyUI graphs so the input can be text, a sketch, or a photo — same core, one LEGO look. And every step is yours to redo, anytime, from the shelf.

**07 · How legolization works → 08 · How colour matches → 09 · Buildable means orderable**
Now the fun part — turning that generated mesh into something you can actually hold. The mesh is thousands of tiny cubes; we merge them into the biggest legal bricks we can. Same for colour — we snap each voxel to the nearest of 48 real LEGO colours. No invented paint. So every set ends up as a small handful of real parts, in colours those parts were actually made in.

**10 · The look lives in the LoRA → 11 · −46% bricks**
The LEGO look itself isn't in the prompt — it's in the fine-tune. Turn the LoRA off, you get a plain building; turn it up, the studs snap in. And the order in which you optimise matters: merging colour before geometry takes Sagrada from 8,600 pieces to 4,700. Cheaper, simpler, just as stable.

**12 · Draft to flagship**
And you pick the detail, draft to flagship — same connected set every time.

**13 · The honest part**
And honestly? when we tried typing "Gehry." The model built its own version of Gehry — not the Guggenheim Bilbao. But a voxel grid can't hold every curve. Knowing where it breaks is part of the work.

**14 · Inputs → outputs**
And that's it — from a few words to a boxed set, a booklet, and a parts list you can order. Thanks.
