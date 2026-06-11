// Example chips — full rich prompts following the house structure:
//   {subject}, LEGO Architecture set, {massing/form}, {brick materials + named
//   colours}, {surface pattern}, {base description}, {structural detail}, {studio tail}
// Using the full prompt (rather than just a name) gives FLUX maximum input even
// with no Claude key. The backend prepends the `legoarch` LoRA trigger.
//
// Curated for the PIPELINE, not just the render: prismatic / stacked /
// terraced massing survives TRELLIS reconstruction and ~32-stud voxelization;
// curved or translucent icons (Fondation Louis Vuitton, Daxing) render
// gorgeously but shred downstream — they live on in docs/benchmarks.md as
// documented stress cases instead.
const TAIL =
  "standalone model on dark display base, white background, elevated 3/4 angle, " +
  "product photography, studio lighting, official LEGO set photography";

export const EXAMPLES = [
  {
    label: "Habitat 67",
    prompt:
      "Habitat 67 Montreal Moshe Safdie, LEGO Architecture set, stacked offset " +
      "concrete cube modules forming a terraced pyramidal hill, smooth light bluish " +
      "grey and tan plastic bricks, repeating modular box pattern with recessed " +
      "terrace openings, cantilevered cubic clusters over a solid podium, light " +
      "bluish grey volumes, tan terrace insets, dark grey shadow gaps, " + TAIL,
  },
  {
    label: "La Muralla Roja",
    prompt:
      "La Muralla Roja Calpe Ricardo Bofill, LEGO Architecture set, interlocking " +
      "geometric courtyard fortress of stacked stair towers and crossing walls, " +
      "smooth dark red and coral plastic bricks, repeating vertical slot openings " +
      "and rooftop terraces with external stairs, monolithic interlocked massing on " +
      "a solid plinth, dark red walls, coral pink courtyards, medium lavender and " +
      "sand blue accents, " + TAIL,
  },
  {
    label: "Salk Institute",
    prompt:
      "Salk Institute La Jolla Louis Kahn, LEGO Architecture set, twin mirrored " +
      "terraced concrete laboratory blocks flanking a central travertine plaza " +
      "channel, smooth tan and light bluish grey plastic bricks, rhythmic angled " +
      "study towers with deep window recesses, long symmetric low massing on a " +
      "solid plinth, tan plaza spine, light bluish grey concrete volumes, dark grey " +
      "shadow slots, " + TAIL,
  },
  {
    label: "MAS Antwerp",
    prompt:
      "MAS Museum Antwerp Neutelings Riedijk, LEGO Architecture set, ten stacked " +
      "sandstone box volumes spiraling upward into a single bold tower, smooth dark " +
      "red and reddish brown plastic bricks, alternating rotated storey blocks with " +
      "tall corner window slots, massive monolithic stacked massing on a solid " +
      "plinth, dark red stone volumes, reddish brown bands, light bluish grey " +
      "plinth, " + TAIL,
  },
  {
    label: "El Castillo",
    prompt:
      "El Castillo pyramid Chichen Itza, LEGO Architecture set, nine-tiered stepped " +
      "stone pyramid with grand axial staircases on all four sides and a crowning " +
      "temple block, smooth tan and dark tan plastic bricks, crisp receding terrace " +
      "tiers with bold stair ramps, perfectly symmetric monolithic massing, tan " +
      "stone tiers, dark tan shadow lines, light bluish grey temple crown, " + TAIL,
  },
  {
    label: "Brutalist tower",
    prompt:
      "Brutalist concrete tower with stepped setbacks, LEGO Architecture set, " +
      "monolithic stacked rectilinear massing rising in receding tiers, smooth dark " +
      "bluish grey and light grey plastic bricks, board-formed concrete texture " +
      "with deep window recesses, cantilevered terrace slabs, heavy podium base, " +
      "exposed structural grid, " + TAIL,
  },
];
