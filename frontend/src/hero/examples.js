// Full rich example prompts that follow the legoarch reference structure:
//   {subject}, LEGO Architecture set, {massing/form}, {brick materials + named
//   colours}, {surface pattern}, {base description}, {structural detail}, {studio tail}
// Using the full prompt (rather than just a name) gives FLUX maximum input even
// with no Claude key. The backend prepends the `legoarch` LoRA trigger.
const TAIL =
  "standalone model on dark display base, white background, elevated 3/4 angle, " +
  "product photography, studio lighting, official LEGO set photography";

export const EXAMPLES = [
  {
    label: "Fondation Louis Vuitton",
    prompt:
      "Fondation Louis Vuitton Paris Frank Gehry, LEGO Architecture set, multiple " +
      "billowing curved glass sail forms arching over white concrete base, smooth " +
      "translucent light grey and pearl white plastic bricks, overlapping curved " +
      "canopy sails with ribbed surface pattern, angular deconstructivist white base " +
      "volumes beneath, light grey translucent sail panels, bright white concrete " +
      "base, silver grey structural ribs, " + TAIL,
  },
  {
    label: "KAPSARC, Zaha Hadid",
    prompt:
      "KAPSARC Riyadh Zaha Hadid, LEGO Architecture set, cluster of crystalline " +
      "prismatic honeycomb cells forming a low interlocking desert complex, smooth " +
      "matte white and light sand plastic bricks, faceted hexagonal cellular roof " +
      "pattern, angular cantilevered shaded canopies, pale sand-white volumes, light " +
      "grey structural edges, " + TAIL,
  },
  {
    label: "Beijing Daxing Airport",
    prompt:
      "Beijing Daxing International Airport Zaha Hadid, LEGO Architecture set, flowing " +
      "radial starfish terminal with six sweeping curved arms, smooth pearl white and " +
      "light grey plastic bricks, undulating ribbed vaulted roof with skylight " +
      "channels, sculptural C-shaped supporting columns, bright white concourse base, " +
      "silver grey structural ribs, " + TAIL,
  },
  {
    label: "Brutalist tower",
    prompt:
      "Brutalist concrete tower with stepped setbacks, LEGO Architecture set, " +
      "monolithic stacked rectilinear massing rising in receding tiers, smooth dark " +
      "bluish grey and light grey plastic bricks, board-formed concrete texture with " +
      "deep window recesses, cantilevered terrace slabs, heavy podium base, exposed " +
      "structural grid, " + TAIL,
  },
];
