// All copy for the loading theater: the step-aware stage tracks (what the
// pipeline is doing RIGHT NOW) and the rotating educational cards beneath
// (prompt anatomy, what each dial does, pipeline + LEGO facts).
import { PARAMS } from "./tinkerParams.js";

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
        sub: "A text encoder turns your words into the vectors FLUX can steer by.",
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
        sub: "The VAE decodes latents back into pixels — the darkroom moment.",
        estMs: 7000,
      },
    ],
  },
  mesh: {
    totalHint: "four to five minutes — the deep magic",
    steps: [
      {
        id: "shape",
        headline: "Imagining the 3D shape…",
        sub: "TRELLIS sees one photo and infers the geometry — including the sides it has never seen.",
        estMs: 150000,
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

// ---- educational cards -------------------------------------------------------

// Anatomy of the user's ACTUAL prompt: split into the house-structure segments
// and explain why each part is there. Always the first card.
export function promptAnatomy(prompt) {
  const text = (prompt || "").trim();
  if (!text) return null;
  const parts = text.split(/,\s*/);
  const segs = [];
  segs.push({
    chip: "legoarch",
    tone: "yellow",
    why: "the trigger word — added server-side, it activates the custom LoRA fine-tuned on official set photos",
  });
  if (parts[0])
    segs.push({ chip: parts[0], tone: "blue", why: "the subject — building + architect anchors the form" });
  const massing = parts.find((p) => /massing|form|volume|stacked|terraced|curved|tower|module/i.test(p));
  if (massing)
    segs.push({ chip: massing, tone: "red", why: "massing language — tells FLUX the big shapes, which is what survives into bricks" });
  const palette = parts.find((p) => /grey|gray|white|tan|sand|red|blue|black|orange|terracotta/i.test(p));
  if (palette)
    segs.push({ chip: palette, tone: "neutral", why: "a NAMED color palette — the brick-matcher maps these to real LEGO colors" });
  if (/product photography|studio lighting/i.test(text))
    segs.push({
      chip: "product photography, studio lighting…",
      tone: "neutral",
      why: "the styling tail — white background + 3/4 angle is exactly what the 3D reconstruction needs",
    });
  return segs;
}

// One card per Tinker dial, personalised with the value THIS run uses.
export function dialCards(params) {
  return PARAMS.map((p) => {
    const v = params?.[p.key] ?? p.def;
    const isDefault = v === p.def;
    return {
      kind: "dial",
      title: `Dial: ${p.label}`,
      body: `${p.blurb} You're running ${v}${isDefault ? " — the benchmarked sweet spot." : ` (default ${p.def}) — you tinkered!`}`,
    };
  });
}

export const FACTS = [
  {
    title: "Why studs are 8 mm",
    body: "LEGO's 1958 patent fixed the stud pitch at 8 mm and the brick height at 9.6 mm — a 5:6 ratio. Our voxel grid uses exactly those proportions.",
  },
  {
    title: "Three plates = one brick",
    body: "A plate is exactly 1/3 of a brick's height. Real LEGO Architecture sets are mostly plates and tiles — that's how they get those fine terraces and rooflines.",
  },
  {
    title: "Tiles: the smooth finish",
    body: "Tiles are plates without studs. Spot them on every LEGO Architecture roof and plaza — and on the roofs of this set, placed automatically wherever a top face is exposed.",
  },
  {
    title: "The running bond",
    body: "Masons stagger brick joints so cracks can't travel — and so does our solver: it pays a penalty every time a seam would stack on the seam below.",
  },
  {
    title: "TRELLIS guesses the back",
    body: "Image-to-3D is an inverse problem: one photo, infinite possible backs. TRELLIS uses a learned prior over 3D shapes to pick the most plausible one.",
  },
  {
    title: "CFG, in one sentence",
    body: "Classifier-free guidance renders your prompt AND an empty prompt, then pushes the image toward the difference — the slider is literally 'how hard to push'.",
  },
  {
    title: "What a LoRA is",
    body: "A Low-Rank Adaptation is a tiny add-on network (a few MB) that steers a huge model. Ours was trained on LEGO Architecture set photography.",
  },
  {
    title: "Seeds & reproducibility",
    body: "The 'randomness' in diffusion is pseudo-random: fix the seed and every step replays identically. Pin a seed in Tinker and your set is reproducible forever.",
  },
  {
    title: "Color matching, properly",
    body: "We compare your render's colors to the real LEGO palette in CIE Lab space with CIEDE2000 — the same metric print shops use — not naive RGB distance.",
  },
  {
    title: "Why negative prompts work here",
    body: "Our FLUX checkpoint is the undistilled 'base' — real guidance is active, so listing 'trees, people, antennas' as negatives genuinely steers them away.",
  },
  {
    title: "Connectivity check",
    body: "Before you see the set, a 6-neighbour flood-fill proves every brick connects to the body — no floating islands allowed in a buildable model.",
  },
  {
    title: "The pipeline in one breath",
    body: "Words → FLUX render → TRELLIS mesh → plate-unit voxels → brick solver → stability check → your set. GenAI proposes the form; deterministic computation proves it's buildable.",
  },
];

export const PIPELINE_CARDS = [
  {
    title: "Meet FLUX.2 Klein",
    body: "A 4-billion-parameter rectified-flow image model running locally on this machine. With the legoarch LoRA it doesn't draw buildings — it photographs sets that never existed.",
  },
  {
    title: "Meet TRELLIS.2",
    body: "Microsoft's image-to-3D model. It generates a sparse 3D latent in stages — silhouette first, then surface detail, then texture — before exporting the mesh we voxelize.",
  },
  {
    title: "Meet the legolizer",
    body: "Our own engine (no AI here, on purpose): voxelize → split-and-merge bricks → CIEDE2000 colors → stability proof. Published algorithms, custom integration — that's the thesis.",
  },
];

// Build the rotating deck for a run. Prompt anatomy first, then an interleave
// of pipeline intros, personalised dials and facts — deterministic order, no
// Math.random, so re-renders don't reshuffle mid-wait.
export function eduCards({ prompt, params }) {
  const deck = [];
  const anatomy = promptAnatomy(prompt);
  if (anatomy) deck.push({ kind: "anatomy", title: "Anatomy of your prompt", segs: anatomy });
  const dials = dialCards(params);
  const rest = [...PIPELINE_CARDS.map((c) => ({ kind: "pipeline", ...c })), ...FACTS.map((c) => ({ kind: "fact", ...c }))];
  // interleave: pipeline/fact, dial, fact, dial ... keeps variety without RNG
  let di = 0;
  for (let i = 0; i < rest.length; i++) {
    deck.push(rest[i]);
    if (i % 2 === 1 && di < dials.length) deck.push(dials[di++]);
  }
  while (di < dials.length) deck.push(dials[di++]);
  return deck;
}
