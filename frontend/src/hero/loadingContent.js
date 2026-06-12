// All copy for the loading theater: the step-aware stage tracks (what the
// pipeline is doing RIGHT NOW) and the rotating educational cards beneath
// (prompt anatomy, what each dial does, pipeline + LEGO facts).
import { PARAMS } from "./tinkerParams.js";
import { parsePromptSlots } from "../lib/promptGrammar.js";

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

// One card per Tinker dial, personalised with the value THIS run uses.
// Pass a group ("render" | "shape" | "bricks") to keep the deck on-stage.
export function dialCards(params, group) {
  return PARAMS.filter((p) => !group || p.group === group).map((p) => {
    const v = params?.[p.key] ?? p.def;
    const isDefault = v === p.def;
    return {
      kind: "dial",
      title: `Dial: ${p.label}`,
      body: `${p.blurb} You're running ${v}${isDefault ? " — the benchmarked sweet spot." : ` (default ${p.def}) — you tinkered!`}`,
    };
  });
}

// Each fact is tagged with the stage(s) whose wait it belongs to: image =
// diffusion/prompt craft, mesh = 3D reconstruction, bricks = LEGO science.
// The one multi-stage card is the closer appended to every deck.
export const FACTS = [
  {
    title: "Why studs are 8 mm",
    stages: ["bricks"],
    body: "LEGO's 1958 patent fixed the stud pitch at 8 mm and the brick height at 9.6 mm — a 5:6 ratio. Our voxel grid uses exactly those proportions.",
  },
  {
    title: "Three plates = one brick",
    stages: ["bricks"],
    body: "A plate is exactly 1/3 of a brick's height. Real LEGO Architecture sets are mostly plates and tiles — that's how they get those fine terraces and rooflines.",
  },
  {
    title: "Tiles: the smooth finish",
    stages: ["bricks"],
    body: "Tiles are plates without studs. Spot them on every LEGO Architecture roof and plaza — and on the roofs of this set, placed automatically wherever a top face is exposed.",
  },
  {
    title: "The running bond",
    stages: ["bricks"],
    body: "Masons stagger brick joints so cracks can't travel — and so does our solver: it pays a penalty every time a seam would stack on the seam below.",
  },
  {
    title: "TRELLIS guesses the back",
    stages: ["mesh"],
    body: "Image-to-3D is an inverse problem: one photo, infinite possible backs. TRELLIS uses a learned prior over 3D shapes to pick the most plausible one.",
  },
  {
    title: "Prompt strength, in one sentence",
    stages: ["image"],
    body: "Classifier-free guidance renders your prompt AND an empty prompt, then pushes the image toward the difference — the slider is literally 'how hard to push'.",
  },
  {
    title: "What a LoRA is",
    stages: ["image"],
    body: "A Low-Rank Adaptation is a tiny add-on network (a few MB) that steers a huge model. Ours was trained on LEGO Architecture set photography.",
  },
  {
    title: "Seeds & reproducibility",
    stages: ["image"],
    body: "The 'randomness' in diffusion is pseudo-random: fix the seed and every step replays identically. Pin a seed in Tinker and your set is reproducible forever.",
  },
  {
    title: "Color matching, properly",
    stages: ["bricks"],
    body: "We compare your render's colors to the real LEGO palette in CIE Lab space with CIEDE2000 — the same metric print shops use — not naive RGB distance.",
  },
  {
    title: "Why negative prompts work here",
    stages: ["image"],
    body: "Our FLUX checkpoint is the undistilled 'base' — real guidance is active, so listing 'trees, people, antennas' as negatives genuinely steers them away.",
  },
  {
    title: "Connectivity check",
    stages: ["bricks"],
    body: "Before you see the set, a 6-neighbour flood-fill proves every brick connects to the body — no floating islands allowed in a buildable model.",
  },
  {
    title: "The pipeline in one breath",
    stages: ["image", "mesh", "bricks"],
    body: "Words → FLUX render → TRELLIS mesh → plate-unit voxels → brick solver → stability check → your set. GenAI proposes the form; deterministic computation proves it's buildable.",
  },
];

export const PIPELINE_CARDS = [
  {
    title: "Meet FLUX.2 Klein",
    stage: "image",
    body: "A 4-billion-parameter rectified-flow image model running locally on this machine. With the legoarch LoRA it doesn't draw buildings — it photographs sets that never existed.",
  },
  {
    title: "Meet TRELLIS.2",
    stage: "mesh",
    body: "Microsoft's image-to-3D model. It generates a sparse 3D latent in stages — silhouette first, then surface detail, then texture — before exporting the mesh we voxelize.",
  },
  {
    title: "Meet the legolizer",
    stage: "bricks",
    body: "Our own engine (no AI here, on purpose): voxelize → split-and-merge bricks → CIEDE2000 colors → stability proof. Published algorithms, custom integration — that's the thesis.",
  },
];

// which Tinker group is "live" during each stage's wait
const STAGE_GROUP = { image: "render", mesh: "shape", bricks: "bricks" };

// alternate a, b, a, b… then drain whichever list runs longer
function weave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// Build the rotating deck for ONE stage's wait — each waiting room teaches
// only its own stage: image = prompt craft + FLUX, mesh = 3D reconstruction,
// bricks = LEGO science. Deterministic order, no Math.random, so re-renders
// don't reshuffle mid-wait. Every deck closes with the all-stage summary card.
export function eduCards({ stage = "image", prompt, params }) {
  const deck = [];
  if (stage === "image") {
    const anatomy = promptAnatomy(prompt);
    if (anatomy) deck.push({ kind: "anatomy", title: "Anatomy of your prompt", segs: anatomy });
  }

  // the stage's pipeline intro ("Meet FLUX / TRELLIS / the legolizer") first
  deck.push(...PIPELINE_CARDS.filter((c) => c.stage === stage).map((c) => ({ kind: "pipeline", ...c })));

  const facts = FACTS
    .filter((c) => c.stages.includes(stage) && c.stages.length === 1)
    .map((c) => ({ kind: "fact", ...c }));
  const dials = dialCards(params, STAGE_GROUP[stage]);
  // image leads with prompt-science facts; mesh/bricks lead with the dials the
  // user just had in hand at the previous stop
  deck.push(...(stage === "image" ? weave(facts, dials) : weave(dials, facts)));

  // the closer: "The pipeline in one breath" ends every deck
  deck.push(...FACTS.filter((c) => c.stages.length > 1).map((c) => ({ kind: "fact", ...c })));
  return deck;
}
