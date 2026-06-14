// All copy for the loading theater: the step-aware stage tracks (what the
// pipeline is doing RIGHT NOW) and the rotating educational cards beneath
// (prompt anatomy, what each dial does, pipeline + LEGO facts).
import { PARAMS } from "../tinkerParams.js";
import { parsePromptSlots } from "../../lib/promptGrammar.js";

// Stage timelines. estMs values are honest pacing hints, not promises — the
// progress bar eases toward ~90% of each step and PARKS until the real await
// resolves (we never fake a finish).
export const STAGE_TRACKS = {
  image: {
    totalHint: "about half a minute",
    steps: [
      {
        id: "encode",
        headline: "Reading your prompt…",
        sub: "Your words are translated into the numbers the image model steers by.",
        estMs: 5000,
      },
      {
        id: "denoise",
        headline: "Denoising the render…",
        sub: "FLUX starts from pure noise and sculpts your building out of it, step by step — 28 passes by default.",
        estMs: 22000,
      },
      {
        id: "develop",
        headline: "Developing the photo…",
        sub: "The compressed image is developed into real pixels — the darkroom moment.",
        estMs: 7000,
      },
    ],
  },
  mesh: {
    totalHint: "4–6 minutes",
    steps: [
      {
        id: "shape",
        headline: "Imagining the 3D shape…",
        sub: "TRELLIS sees one photo and infers the geometry — including the sides it has never seen.",
        estMs: 200000,
      },
      {
        id: "texture",
        headline: "Painting the surfaces…",
        sub: "A second diffusion pass wraps the mesh in color — we sample these very pixels for the brick palette.",
        estMs: 120000,
      },
    ],
  },
  bricks: {
    totalHint: "a few seconds — no AI here, on purpose",
    steps: [
      {
        id: "voxelize",
        headline: "Slicing it into a stud grid…",
        sub: "The smooth mesh becomes plate-height voxels: 8 mm wide, 3.2 mm tall — real LEGO proportions.",
        estMs: 4000,
      },
      {
        id: "legolize",
        headline: "Solving the brick layout…",
        sub: "A greedy split-and-merge packs legal bricks course by course, staggering seams like a real mason.",
        estMs: 5000,
      },
    ],
  },
};

// Stage canon for the whole journey: step 1 Visualize · step 2 Materialize ·
// step 3 Legolize. The theater's eyebrow reads from here.
export const STAGE_META = {
  image: { ord: 1, title: "Visualize" },
  mesh: { ord: 2, title: "Materialize" },
  bricks: { ord: 3, title: "Legolize" },
};

// ---- educational cards -------------------------------------------------------

// Anatomy of the user's ACTUAL prompt, parsed against the shared 8-slot
// grammar (backend/app/prompt_grammar.json via lib/promptGrammar.js) — the
// same slots the enhancer writes and the RecipeCard explains. Always the
// first card of the image-stage deck.
export function promptAnatomy(prompt) {
  const text = (prompt || "").trim();
  if (!text) return null;
  const slots = parsePromptSlots(text);
  if (!slots.length) return null;
  return slots.map((s) => ({
    chip: s.text.length > 64 ? s.text.slice(0, 61) + "…" : s.text,
    tone: s.tone,
    why: `${s.name} — ${s.ui_hint}`,
  }));
}

// One card for a single Tinker dial, personalised with the value THIS run
// uses. The hook (card front) leads with the live value; the body (card back)
// carries the full blurb.
export function dialCard(params, key) {
  const p = PARAMS.find((x) => x.key === key);
  if (!p) return null;
  const v = params?.[p.key] ?? p.def;
  const isDefault = v === p.def;
  return {
    kind: "dial",
    icon: "gauge",
    title: `Dial: ${p.label}`,
    hook: `Yours is set to ${v}${isDefault ? " — the benchmarked sweet spot." : " — you tinkered."}`,
    body: `${p.blurb} You're running ${v}${isDefault ? " — the benchmarked sweet spot." : ` (default ${p.def}) — you tinkered!`}`,
    // numeric dials get a mini-gauge on the card front (value vs default)
    gauge: p.kind === "choice" ? null : { min: p.min, max: p.max, def: p.def, value: v },
  };
}

// Each fact is tagged with the stage(s) whose wait it belongs to: image =
// diffusion/prompt craft, mesh = 3D reconstruction, bricks = LEGO science.
// `hook` is the one-line front-of-card teaser; `body` is the card back.
export const FACTS = [
  {
    title: "Why studs are 8 mm",
    icon: "ruler",
    stages: ["bricks"],
    hook: "The 1958 patent still rules our grid.",
    body: "LEGO's 1958 patent fixed the stud pitch at 8 mm and the brick height at 9.6 mm — a 5:6 ratio. Our voxel grid uses exactly those proportions.",
  },
  {
    title: "Three plates = one brick",
    icon: "layers",
    stages: ["bricks"],
    hook: "The 1:3 ratio behind every fine roofline.",
    body: "A plate is exactly 1/3 of a brick's height. Real LEGO Architecture sets are mostly plates and tiles — that's how they get those fine terraces and rooflines.",
  },
  {
    title: "Tiles: the smooth finish",
    icon: "layout-grid",
    stages: ["bricks"],
    hook: "Plates without studs — the pro finish.",
    body: "Tiles are plates without studs. Spot them on every LEGO Architecture roof and plaza — and on the roofs of this set, placed automatically wherever a top face is exposed.",
  },
  {
    title: "The running bond",
    icon: "blocks",
    stages: ["bricks"],
    hook: "Why masons — and we — stagger every seam.",
    body: "Masons stagger brick joints so cracks can't travel — and so does our solver: it pays a penalty every time a seam would stack on the seam below.",
  },
  {
    title: "TRELLIS guesses the back",
    icon: "box",
    stages: ["mesh"],
    hook: "One photo, infinite possible backs.",
    body: "Image-to-3D is an inverse problem: one photo, infinite possible backs. TRELLIS uses a learned prior over 3D shapes to pick the most plausible one.",
  },
  {
    title: "Prompt strength, in one sentence",
    icon: "gauge",
    stages: ["image"],
    hook: "The slider is literally 'how hard to push'.",
    body: "Classifier-free guidance renders your prompt AND an empty prompt, then pushes the image toward the difference — the slider is literally 'how hard to push'.",
  },
  {
    title: "What a LoRA is",
    icon: "wand",
    stages: ["image"],
    hook: "A few megabytes steering four billion parameters.",
    body: "A Low-Rank Adaptation is a tiny add-on network (a few MB) that steers a huge model. Ours was trained on LEGO Architecture set photography.",
  },
  {
    title: "Seeds & reproducibility",
    icon: "dices",
    stages: ["image"],
    hook: "Fix the seed, replay the magic forever.",
    body: "The 'randomness' in diffusion is pseudo-random: fix the seed and every step replays identically. Pin a seed in Tinker and your set is reproducible forever.",
  },
  {
    title: "Color matching, properly",
    icon: "palette",
    stages: ["mesh", "bricks"],
    hook: "Print-shop color science, not naive RGB.",
    body: "We compare your render's colors to the real LEGO palette in CIE Lab space with CIEDE2000 — the same metric print shops use — not naive RGB distance. The pixels being painted right now are the ones we'll match.",
  },
  {
    title: "Why negative prompts work here",
    icon: "eye-off",
    stages: ["image"],
    hook: "Telling it what NOT to draw actually works.",
    body: "Our FLUX checkpoint is the undistilled 'base' — real guidance is active, so listing 'trees, people, antennas' as negatives genuinely steers them away.",
  },
  {
    title: "Connectivity check",
    icon: "link",
    stages: ["bricks"],
    hook: "No floating islands allowed.",
    body: "Before you see the set, a 6-neighbour flood-fill proves every brick connects to the body — no floating islands allowed in a buildable model.",
  },
  // ---- mesh-wait additions: the longest room gets the richest deck ----
  {
    title: "Structured latents",
    icon: "shapes",
    stages: ["mesh"],
    hook: "TRELLIS thinks in sparse 3D pixels.",
    body: "TRELLIS doesn't sculpt triangles directly — it denoises a sparse grid of 'structured latents': packets of shape-and-appearance information only where the building actually is. Empty air costs nothing.",
  },
  {
    title: "Why this takes minutes",
    icon: "hourglass",
    stages: ["mesh"],
    hook: "Diffusion, but cubed.",
    body: "Your render took 28 denoising passes over a flat image. The mesh needs the same trick in 3D — coarse structure first, then fine surface latents — and every pass touches a volume, not a picture. That's the 4–6 minutes.",
  },
  {
    title: "Half a million teachers",
    icon: "graduation-cap",
    stages: ["mesh"],
    hook: "It has seen ~500,000 shapes before yours.",
    body: "TRELLIS learned its sense of 'how objects usually go' from roughly 500,000 3D assets. When your photo hides a facade, it doesn't guess randomly — it leans on every building-shaped thing it has ever seen.",
  },
  {
    title: "Texture is its own pass",
    icon: "paintbrush",
    stages: ["mesh"],
    hook: "First the clay, then the paint.",
    body: "Once the geometry settles, a second generative pass paints color onto the surfaces. Those exact painted pixels are what we later match to real LEGO colors — this stage quietly chooses your palette.",
  },
  {
    title: "Decimation, the quiet step",
    icon: "scissors",
    stages: ["mesh"],
    hook: "A million triangles walk into a voxel grid…",
    body: "The raw mesh can carry hundreds of thousands of triangles. Before export it's decimated — simplified while keeping the silhouette. Fine by us: the voxelizer only cares about the volume, not the wireframe.",
  },
  {
    title: "What happens after this",
    icon: "arrow-right",
    stages: ["mesh"],
    hook: "The AI's last act.",
    body: "This is the final AI stage. Next, deterministic code takes over: the mesh is sliced into plate-height voxels and solved into legal bricks in seconds — fully repeatable, no dice.",
  },
  {
    title: "The pipeline in one breath",
    icon: "workflow",
    stages: ["image", "mesh", "bricks"],
    hook: "Words to bricks in five moves.",
    body: "Words → FLUX render → TRELLIS mesh → plate-unit voxels → brick solver → stability check → your set. GenAI proposes the form; deterministic computation proves it's buildable.",
  },
];

export const PIPELINE_CARDS = [
  {
    title: "Meet FLUX.2 Klein",
    icon: "camera",
    stage: "image",
    hook: "It photographs sets that never existed.",
    body: "A 4-billion-parameter rectified-flow image model running locally on this machine. With the legoarch LoRA it doesn't draw buildings — it photographs sets that never existed.",
  },
  {
    title: "Meet TRELLIS.2",
    icon: "boxes",
    stage: "mesh",
    hook: "It sees one photo and thinks in 3D.",
    body: "Microsoft's image-to-3D model. It generates a sparse 3D latent in stages — silhouette first, then surface detail, then texture — before exporting the mesh we voxelize.",
  },
  {
    title: "Meet the legolizer",
    icon: "hammer",
    stage: "bricks",
    hook: "No AI in this stage — on purpose.",
    body: "Our own engine (no AI here, on purpose): voxelize → split-and-merge bricks → CIEDE2000 colors → stability proof. Published algorithms, custom integration — that's the thesis.",
  },
];

// Curated deck per stage — sized to the wait, not to what's lying around:
// image ≈ 35 s → 7 cards, mesh = 4–6 MIN (the long room) → 12 cards,
// bricks ≈ seconds → 6 cards. Entries: "#title" = pipeline intro,
// "$key" = live dial card, plain string = fact by title. Deterministic
// order, no Math.random, so re-renders never reshuffle mid-wait; every deck
// closes with the all-stage summary card.
const STAGE_DECKS = {
  image: [
    "#Meet FLUX.2 Klein",
    "Seeds & reproducibility",
    "$guidance",
    "What a LoRA is",
    "$lora_scale",
    "The pipeline in one breath",
  ],
  mesh: [
    "#Meet TRELLIS.2",
    "TRELLIS guesses the back",
    "$shape_guidance",
    "Structured latents",
    "Why this takes minutes",
    "$shape_steps",
    "Half a million teachers",
    "Texture is its own pass",
    "Color matching, properly",
    "Decimation, the quiet step",
    "What happens after this",
    "The pipeline in one breath",
  ],
  bricks: [
    "#Meet the legolizer",
    "Why studs are 8 mm",
    "The running bond",
    "Connectivity check",
    "Tiles: the smooth finish",
    "The pipeline in one breath",
  ],
};

export function eduCards({ stage = "image", prompt, params }) {
  const deck = [];
  if (stage === "image") {
    const anatomy = promptAnatomy(prompt);
    if (anatomy)
      deck.push({
        kind: "anatomy",
        icon: "type",
        title: "Anatomy of your prompt",
        hook: "Your words, slotted into the grammar.",
        segs: anatomy,
      });
  }
  for (const ref of STAGE_DECKS[stage] ?? []) {
    if (ref.startsWith("#")) {
      const c = PIPELINE_CARDS.find((p) => p.title === ref.slice(1));
      if (c) deck.push({ kind: "pipeline", ...c });
    } else if (ref.startsWith("$")) {
      const c = dialCard(params, ref.slice(1));
      if (c) deck.push(c);
    } else {
      const c = FACTS.find((f) => f.title === ref);
      if (c) deck.push({ kind: "fact", ...c });
    }
  }
  return deck;
}
