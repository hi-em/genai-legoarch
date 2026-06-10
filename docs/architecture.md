# lEgoarCh — flow & architecture

Diagrams render automatically on GitHub and in any Mermaid viewer.

> **The thesis in one line:** *Generative AI proposes the form; deterministic computation proves it's buildable.*
> A prior course project stopped at generated **images**. lEgoarCh continues downstream to a real, legal, buildable brick set.

---

## 1. Pipeline & data flow (the headline)

One cinematic flow: name a building → render → reconstruct → **solve into legal bricks** → package as a product. The backend is the **single source of truth** for the brick layout.

```mermaid
flowchart TD
    IN["Input: building name / rich prompt / reference photo"]:::io

    subgraph GEN["Generative AI — proposes the form (ComfyUI, local GPU)"]
      direction TB
      LORA["FLUX.2 + legoarch LoRA<br/>txt2img / img2img (:8188)"]:::gen
      IMG["LEGO-Architecture render"]:::gen
      TRELLIS["TRELLIS-2 — image to textured 3D mesh (:8189)"]:::gen
      LORA --> IMG --> TRELLIS
    end

    subgraph COMP["Deterministic computation — proves it is buildable (FastAPI)"]
      direction TB
      VOX["Voxelize the mesh + sample colour,<br/>exposure-matched to the render"]:::comp
      LEGO["Split-and-merge into legal bricks (Luo 2015)<br/>+ nearest LEGO colour (CIEDE2000)"]:::comp
      CHK["Stability: connectivity + support"]:::comp
      VOX --> LEGO --> CHK
    end

    IN --> LORA
    TRELLIS --> VOX
    CHK --> SET["Buildable brick set<br/>(real footprints, matched colours)"]:::io

    SET --> ASM["Assemble course-by-course (3D)"]:::fun
    ASM --> TRO["Trophies: The Box · Instructions PDF ·<br/>Priced set · Share card"]:::fun
    TRO --> SHELF["Collection — your persistent shelf"]:::fun

    classDef gen fill:#e3eefc,stroke:#1e5aa8,color:#16324f;
    classDef comp fill:#e7f3ea,stroke:#237a3c,color:#143a22;
    classDef io fill:#eef0ee,stroke:#6c6e68,color:#20262b;
    classDef fun fill:#fdf3cf,stroke:#c39e00,color:#5a4a00;
```

The smooth TRELLIS mesh is an **internal step**, not the product — the studded, discrete, buildable set is the output. (The mesh/voxel grid is what makes the bricks *match the building*.)

---

## 2. System architecture

```mermaid
flowchart LR
    subgraph FE["Frontend — React + three.js"]
      direction TB
      HERO["Hero flow:<br/>type → render → assemble → reveal"]
      COLL["Collection:<br/>saved sets + per-set detail"]
      VIEW["three.js viewers<br/>(footprint bricks + studs, assembly)"]
      TRO["Trophies + exports<br/>(box / booklet / priced / share / LDraw / CSV)"]
      STORE["Zustand + localStorage shelf"]
    end

    subgraph API["Backend — FastAPI (single source of truth)"]
      direction TB
      EP["/generate-image · /generate-3d · /legolize · /set-copy · /health"]
      CC["comfy_client (REST, two ComfyUI)"]
      LEGOLIB["legolizer:<br/>voxelize · bricks · color · stability · ldraw"]
      PERS["set_designer (persona) · prompt_enhance"]
      EP --> CC
      EP --> LEGOLIB
      EP --> PERS
    end

    subgraph CMF["ComfyUI — local GPU"]
      direction TB
      FLUX["FLUX.2 + legoarch LoRA (:8188)"]
      TREL["TRELLIS-2 (:8189)"]
    end

    HERO -->|/api| EP
    COLL -->|/api| EP
    CC --> FLUX
    CC --> TREL

    classDef fe fill:#e3eefc,stroke:#1e5aa8,color:#16324f;
    classDef be fill:#e7f3ea,stroke:#237a3c,color:#143a22;
    classDef cf fill:#fdf3cf,stroke:#c39e00,color:#5a4a00;
    class FE,HERO,COLL,VIEW,TRO,STORE fe;
    class API,EP,CC,LEGOLIB,PERS be;
    class CMF,FLUX,TREL cf;
```

The app requires the live backend + ComfyUI (no mock mode). The frontend renders whatever bricks the backend returns; it never invents geometry. A DEV-only "Preview the assembly" button loads one real bundled sample so the UI can be exercised without a GPU.

---

## 3. The custom legolizer (the computational core)

The original contribution — not a wrapper around an off-the-shelf converter. Lives in `backend/app/legolizer/`.

```mermaid
flowchart LR
    V["Voxel grid + per-voxel colour<br/>(from the TRELLIS mesh)"]:::c --> B["Split-and-merge into legal bricks<br/>1×1…2×4, seam-staggered (Luo 2015)"]:::c
    B --> C["Per-brick colour<br/>real model colour → LEGO palette (CIEDE2000)"]:::c
    C --> S["Stability: connectivity + support ratio"]:::c
    S --> L["Export: LDraw .ldr · parts list/CSV · instruction PDF"]:::c
    classDef c fill:#e7f3ea,stroke:#237a3c,color:#143a22;
```

Outputs measurable, defensible metrics (not FID/CLIP): **% supported, connectivity (single component), piece count, parts list** — structural-plausibility evidence. Every emitted part is a real BrickLink id (`3001` 2×4, `3004` 1×2, `3003` 2×2, `3622` 1×3, `3010` 1×4, `3002` 2×3, `3005` 1×1).

---

## 4. User journey

```mermaid
stateDiagram-v2
    [*] --> Type
    Type --> Rendering: Forge the set
    Rendering --> Assembling: render + bricks solved
    Assembling --> Reveal: set assembled
    Reveal --> Trophies: Box / Instructions / Priced / Share
    Reveal --> Collection: Add to shelf
    Reveal --> Type: Forge another
    Collection --> SetDetail: open a saved set
    SetDetail --> Trophies: reopen box / exports
    Collection --> Type: forge a new one
```

**Feature summary**
- **Hero flow** — type → FLUX render → course-by-course assembly → reveal.
- **Set designer** — auto-names the set and writes box copy (Claude if keyed, else templates).
- **Trophies** — The Box (art), Instruction booklet (PDF), Priced set (estimate + BrickLink link), Share card.
- **Collection** — persistent shelf; reopen any set with live 3D + trophies + LDraw/CSV.
- **Fun layer** — felt "build table", BrickBuddy mascot, snap/pop sounds (mute in the header), LEGO-grounded visual system (see `design-system.md`), trademark-safe.
