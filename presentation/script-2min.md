# lEgoarCh — Slide Script (~2 min)

Conversational pace, humble tone. ~290 words. Pause on the slide changes.

---

**01 · Title**
Name a building, get a LEGO set you can actually order. You just saw it work — now here's what's happening underneath.

**02 · Why it matters**
Why bother? Three reasons. It's real bricks, not a render. It's something a client keeps, not foam they bin. And change the design, you only reorder what changed.

**03 · The system**
Here's the whole pipeline. Two AI models propose the form — a render, then a 3D mesh. Everything after is plain code that proves it builds.

**04 · The experience**
And every step is yours to redo, anytime, from the shelf.

**05 · The models**
The imagining is just two models. FLUX dreams the picture; TRELLIS carves it into 3D — even the back the photo can't see.

**06 · ComfyUI workflows**
We wrapped that in three small ComfyUI graphs — text or image in, same core, one LEGO look.

**07 · How legolization works**
Now the fun part. The mesh is thousands of tiny cubes; we merge them into the biggest legal bricks we can. Fewer parts, same shape.

**08 · How colour matches**
Same for colour — we snap each voxel to the nearest of 48 real LEGO colours. No invented paint.

**09 · Buildable means orderable**
So every set is a small handful of real parts, in colours those parts were actually made in.

**10 · The look lives in the LoRA**
We tested it. The look isn't the prompt, it's the fine-tune — turn it off, plain building; turn it up, the studs snap in.

**11 · −46% bricks**
Merging colour first really matters — it takes Sagrada from 8,600 pieces to 4,700. Cheaper, simpler, just as stable.

**12 · Draft to flagship**
And you pick the detail, draft to flagship — same connected set every time.

**13 · The honest part**
And honestly? We tried Gehry's Bilbao. The model followed the curves, but a voxel grid can't hold them — knowing where it breaks is part of the work.

**14 · Inputs → outputs**
And that's it — from a few words to a boxed set, a booklet, and a parts list you can order. Thanks.
