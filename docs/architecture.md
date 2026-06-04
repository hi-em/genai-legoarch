# lEgoarCh — concept, flow & architecture

Diagrams for presenting the project. They render automatically on GitHub and in any Mermaid viewer.

> **The thesis in one line:** *Generative AI proposes the form; deterministic computation proves it's buildable.*
> A prior course project stopped at generated **images**. lEgoarCh continues downstream to a thing you can **hold** — 3D-printed *or* genuinely built from bricks.

---

## 1. Concept & data flow (the headline)

One pipeline, **two exits**, the user chooses how far to go.

```mermaid
flowchart TD
    IN["Input: building photo or text prompt"]:::io

    subgraph GEN["Generative AI — proposes the form"]
      direction TB
      LORA["FLUX.2 + legoarch LoRA<br/>text-to-image / image-to-image"]:::gen
      IMG["LEGO-Architecture render"]:::gen
      TRELLIS["TRELLIS-2 — image to 3D"]:::gen
      M3D["3D model: mesh + voxel grid"]:::gen
      LORA --> IMG --> TRELLIS --> M3D
    end

    subgraph COMP["Deterministic computation — proves it is buildable"]
      direction TB
      LEGO["Custom legolizer"]:::comp
      BM["Buildable brick model"]:::comp
      CHK["Stability + connectivity check"]:::comp
      EXP["Parts list + LDraw + step instructions"]:::comp
      LEGO --> BM --> CHK --> EXP
    end

    IN --> LORA
    M3D --> CHOICE{"How far do you<br/>want to go?"}:::io
    CHOICE -->|"Exit 1 — Print"| STL["Download STL → 3D print<br/>(smooth souvenir)"]:::io
    CHOICE -->|"Exit 2 — Build"| LEGO
    EXP --> SET["Real, buildable LEGO set"]:::io

    STL --> SHELF["My Shelf — your collection"]:::fun
    SET --> SHELF

    classDef gen fill:#e3eefc,stroke:#1e5aa8,color:#16324f;
    classDef comp fill:#e7f3ea,stroke:#237a3c,color:#143a22;
    classDef io fill:#eef0ee,stroke:#6c6e68,color:#20262b;
    classDef fun fill:#fdf3cf,stroke:#c39e00,color:#5a4a00;
```

**Why the two exits matter:** the original worry — *"a 3D-printed smooth mesh loses the LEGO feel"* — is resolved by making the print **Exit 1** (optional) and the discrete, studded, buildable set **Exit 2**. The studs that "ruin" printing are exactly what make the set buildable.

---

## 2. System architecture (frontend / backend / ComfyUI)

```mermaid
flowchart LR
    subgraph FE["Frontend — React + three.js (LEGO-skinned)"]
      direction TB
      UI["Screens:<br/>Generate · 3D-Print · Brick Studio · Shelf · Playground"]
      VIEW["three.js viewer<br/>instanced bricks + studs"]
      CLIENT["Client engine (MOCK mode):<br/>building gen · legolizer · STL/LDraw · thumbnails"]
      STORE["State + localStorage shelf"]
      UI --> VIEW
      UI --> CLIENT
      UI --> STORE
    end

    subgraph API["Backend — FastAPI"]
      direction TB
      EP["Endpoints:<br/>/generate-image · /generate-3d · /legolize · /export"]
      CC["comfy_client<br/>REST + websocket"]
      LEGOLIB["legolizer:<br/>voxelize · bricks · color · stability · ldraw"]
      EP --> CC
      EP --> LEGOLIB
    end

    subgraph CMF["ComfyUI — local GPU"]
      direction TB
      FLUX["FLUX.2 + legoarch LoRA"]
      TREL["TRELLIS-2"]
    end

    UI -. "when ComfyUI is wired<br/>(api.MOCK = false)" .-> EP
    CC --> FLUX
    CC --> TREL

    classDef fe fill:#e3eefc,stroke:#1e5aa8,color:#16324f;
    classDef be fill:#e7f3ea,stroke:#237a3c,color:#143a22;
    classDef cf fill:#fdf3cf,stroke:#c39e00,color:#5a4a00;
    class FE,UI,VIEW,CLIENT,STORE fe;
    class API,EP,CC,LEGOLIB be;
    class CMF,FLUX,TREL cf;
```

**Status today:** the frontend runs entirely on the **client engine** (mock mode) — so the whole experience is clickable without a GPU. Only the two AI steps are mocked; everything downstream (bricks, stability, exports, shelf) is real. Flipping `api.MOCK = false` routes the same UI through FastAPI → ComfyUI.

---

## 3. The custom legolizer (the computational core)

This is the original contribution — not a wrapper around an off-the-shelf converter.

```mermaid
flowchart LR
    V["Voxel grid<br/>(TRELLIS voxelgrid_npz)"]:::c --> B["Split-and-merge<br/>into legal bricks<br/>(Luo 2015)"]:::c
    B --> C["Per-brick color<br/>CIEDE2000 → LEGO palette"]:::c
    C --> S["Stability checks:<br/>connectivity + support<br/>(StableLego-style)"]:::c
    S --> L["Export:<br/>LDraw .ldr + parts list + instructions"]:::c
    classDef c fill:#e7f3ea,stroke:#237a3c,color:#143a22;
```

Outputs measurable, defensible metrics (not FID/CLIP): **% supported, connectivity (single component), brick count, parts list** — the kind of structural-plausibility evidence faculty reward.

---

## 4. User journey & features

```mermaid
stateDiagram-v2
    [*] --> Generate
    Generate --> Viewer3D: render + 3D ready
    Generate --> BrickStudio: skip to bricks
    Viewer3D --> Print: Exit 1 — download STL
    Viewer3D --> BrickStudio: Exit 2 — legolize
    BrickStudio --> Shelf: add to collection
    Print --> Shelf
    Shelf --> Generate: make another
    Generate --> Playground: experiment
    Playground --> Generate: use an idea

    note right of Playground
      Restyle · Recolor ·
      Mashup two landmarks ·
      Sectional detail axo
    end note
    note right of Shelf
      Persisted collection
      of your own builds
    end note
```

**Feature summary**
- **Generate** — prompt/photo → legoarch render + live 3D geometry.
- **3D · Print (Exit 1)** — smooth print preview + real STL export.
- **Brick Studio (Exit 2)** — studded brick model, stability badges, parts list, LDraw/CSV/instructions.
- **My Shelf** — persistent collection of your builds (the "collector" hook).
- **Playground** — restyle, recolor, mashup, planned sectional-axo detail.
- **Fun layer** — LEGO-grounded visual system (see `design-system.md`), trademark-safe.
