// Single source of truth for the user-tunable generation parameters.
// Drives the Tinker slider panel, the API payloads, the educational loading
// cards, and the per-set reproducibility record. Defaults are the winners of
// the A/B benchmark (docs/benchmarks.md) — casual users never need to open
// the panel; tinkerers get safe, labelled ranges.

export const PARAMS = [
  // ---- group "render" (FLUX.2 Klein base + legoarch LoRA) -> /api/generate-image
  {
    key: "steps", group: "render", label: "Render steps",
    min: 8, max: 50, step: 1, def: 28,
    blurb: "How many denoising passes FLUX makes. More = finer stud detail, slower render — past ~28 the gains vanish.",
  },
  {
    key: "guidance", group: "render", label: "Prompt strength",
    min: 1, max: 8, step: 0.5, def: 5,
    blurb: "How strictly the image obeys your words. Low looks washed out; too high overcooks the colors. (In diffusion-speak this dial is called CFG.)",
  },
  {
    key: "lora_scale", group: "render", label: "LEGO style dial",
    min: 0, max: 1.5, step: 0.05, def: 1,
    blurb: "Weight of the legoarch LoRA — the custom fine-tune that makes everything look like an official set photo. Lower it and the bricks melt away.",
  },
  // ---- group "shape" (TRELLIS.2 image->3D) -> /api/generate-3d
  {
    key: "shape_guidance", group: "shape", label: "Shape fidelity",
    min: 3, max: 10, step: 0.5, def: 7.5,
    blurb: "How closely the 3D reconstruction trusts your render vs. its own imagination about the hidden sides.",
  },
  {
    key: "shape_steps", group: "shape", label: "3D quality steps",
    min: 15, max: 40, step: 1, def: 35,
    blurb: "Diffusion steps for the 3D geometry. More = cleaner surfaces, noticeably longer wait.",
  },
  // ---- group "bricks" (voxelizer + legolizer) -> /api/generate-3d
  {
    key: "voxel_target", group: "bricks", label: "Brick detail",
    min: 16, max: 64, step: 2, def: 32,
    blurb: "Studs across the model's longest side. Higher = more pieces and finer architecture — and a much bigger set.",
  },
  {
    key: "randomness", group: "bricks", label: "Bond variety",
    min: 0, max: 0.5, step: 0.02, def: 0.12,
    blurb: "How often the brick solver picks a playful piece instead of the biggest one. A little keeps walls from striping.",
  },
  {
    key: "seam_weight", group: "bricks", label: "Seam stagger",
    min: 0, max: 2, step: 0.1, def: 1,
    blurb: "Penalty for stacking joints on joints — exactly why real brick walls use a running bond. Zero = fragile straight cracks.",
  },
  // ---- the Sprint-1/2 engine dials (catalog era) ----
  {
    key: "fill_mode", group: "bricks", label: "Structure",
    kind: "choice", def: "solid",
    choices: [
      { value: "solid", label: "Solid" },
      { value: "shell", label: "Hollow" },
    ],
    blurb: "Solid packs the core with big hidden bricks. Hollow keeps real walls (like actual LEGO sets) — courtyards and windows stay open, hidden 1x1 pillars are added where physics demands.",
  },
  {
    key: "shell_thickness", group: "bricks", label: "Wall thickness",
    min: 1, max: 4, step: 1, def: 2,
    blurb: "Wall depth in studs when Structure is Hollow. 2 is the sweet spot; 1 gets fragile, 4 is nearly solid again.",
  },
  {
    key: "slopes", group: "bricks", label: "Roof slopes",
    kind: "choice", def: true,
    choices: [
      { value: true, label: "On" },
      { value: false, label: "Off" },
    ],
    blurb: "Bevel one-course roof steps with real 45° slope bricks (3037–3040) facing downhill — the move that turns a ziggurat into a roofline.",
  },
  {
    key: "palette", group: "bricks", label: "Color palette",
    kind: "choice", def: "classic",
    choices: [
      { value: "classic", label: "Classic 23" },
      { value: "full", label: "Full 48" },
    ],
    blurb: "Real production colors from the Rebrickable catalog, validated against LDraw. Classic = the architecture staples; Full = every current color (richer, but busier seams).",
  },
];

export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));

// Outcome presets — one click sets every dial. "balanced" IS the defaults
// (the benchmark winners); the others trade time for detail in both
// directions. Sliders below remain the expert fine-tune layer.
export const PRESETS = [
  {
    id: "draft",
    label: "Quick draft",
    hint: "~3–4 min · smaller set",
    params: { ...DEFAULTS, steps: 16, shape_steps: 20, voxel_target: 24 },
  },
  {
    id: "balanced",
    label: "Tuned default",
    hint: "~6 min · the optimized workflow",
    params: { ...DEFAULTS },
  },
  {
    id: "max",
    label: "Max detail",
    hint: "~8–9 min · big set",
    params: { ...DEFAULTS, steps: 36, shape_steps: 40, voxel_target: 44 },
  },
];

// which preset exactly matches the current params (null -> "Custom")
export const activePreset = (params) =>
  PRESETS.find((pr) => PARAMS.every((p) => (params?.[p.key] ?? p.def) === pr.params[p.key]))?.id ?? null;

export const byKey = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

// number of sliders moved off their tuned default
export const tweakCount = (params) =>
  PARAMS.filter((p) => (params?.[p.key] ?? p.def) !== p.def).length;

// pick the request fields for one or more groups
export const paramsFor = (groups, params) => {
  const want = Array.isArray(groups) ? groups : [groups];
  const out = {};
  for (const p of PARAMS) {
    if (want.includes(p.group)) out[p.key] = params?.[p.key] ?? p.def;
  }
  return out;
};

// human summary of a run record, defaults elided ("seed 1234 · CFG 5 · detail 32")
export function summarizeRun(runRecord) {
  if (!runRecord) return "";
  const bits = [];
  if (runRecord.seed != null) bits.push(`seed ${runRecord.seed}`);
  for (const p of PARAMS) {
    const v = runRecord.params?.[p.key];
    if (v != null && v !== p.def) bits.push(`${p.label.toLowerCase()} ${v}`);
  }
  return bits.join(" · ");
}
