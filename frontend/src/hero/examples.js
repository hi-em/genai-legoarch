// The six example chips — research-grounded prompts (docs sources: LEGO 21065
// press/product pages, sydneyoperahouse.com spherical-solution archive, Arup
// 1973 engineering paper; deep-research sessions 2026-06-12 and 2026-06-15).
// Each follows the 8-slot grammar the benchmark validated:
//   [identity] [LEGO Architecture set] [massing, FUSED verbs + counts]
//   [smooth X+Y plastic bricks] [signature pattern] [base volume]
//   [named LEGO palette WITH placement] [studio tail]
// Massing language keeps volumes FUSED and grounded so the TRELLIS mesh
// voxelizes into a single connected build. The three KEEPERS (Sagrada / Sydney
// / La Muralla) are proven live. The three NEW picks (Bilbao / St. Basil's /
// Colosseum) were owner-chosen for max fame + form/colour diversity over the
// safer set-backed alternatives — each carries a voxelization risk we offset in
// the wording (Bilbao's smooth curves -> "fused ... continuous body"; St.
// Basil's slim dome necks -> "bulbous domes on stout drums"; the Colosseum ring
// -> "one continuous fused oval ring, thick solid wall"). If any shatters on a
// live forge, the research fallbacks are Taj Mahal / Himeji Castle / Great
// Pyramid (all set-backed + voxel-safe). Habitat 67 remains the internal
// enhancement reference in backend/app/prompt_enhance.py — it is not a chip.
// the studio tail comes from the shared grammar — one source of truth
import { STYLE_SUFFIX as TAIL } from "../lib/promptGrammar.js";

export const EXAMPLES = [
  {
    // LEGO's own 21065 (12,060 pcs, the largest set ever) is the fun benchmark:
    // completed basilica, all 18 towers, unified tan stone. Tuned to the 21065
    // box art but RESTRAINED on colour: the tall spires lead with white
    // star/cross finials and Gaudí's red-and-gold ceramic "fruit" accents are
    // kept small + sparse on the lower apostle towers only (an earlier "bright
    // … clusters" wording crowned nearly every spire and read overwhelming).
    label: "Sagrada Família",
    prompt:
      "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, the " +
      "completed basilica as one unified tan-stone massing of eighteen fused " +
      "tapering openwork spires rising in a stepped cluster, the tallest " +
      "central Tower of Jesus Christ a stout fused spire rising far above the " +
      "rest and crowned with a white cross, the slender towers led by white " +
      "star finials with only the lower apostle towers tipped with small " +
      "red-and-gold fruit finials, smooth tan and dark tan plastic bricks, " +
      "vertical lacework stone with pointed pinnacles and tracery, gabled " +
      "portico and stepped apse on a solid dark display base with a few small " +
      "dark green trees, warm tan sandstone throughout, soft dark tan recess " +
      "shadows, sparse red and golden yellow fruit accents, white pinnacle " +
      "stars and cross, " + TAIL,
  },
  {
    // The organic-form showcase. Shells are segments of ONE 75.2 m sphere in
    // mirrored pairs — never "sails" — and two-tone white/cream chevron tile.
    label: "Sydney Opera House",
    prompt:
      "Sydney Opera House Jørn Utzon, LEGO Architecture set, mirrored pairs " +
      "of spherical-segment shell roofs rising in three fused groups from a " +
      "massive solid podium, each shell a curved triangular section of one " +
      "common sphere, smooth white and tan plastic bricks, subtle two-tone " +
      "chevron tile pattern across the shells, broad terraced podium with " +
      "monumental steps, glossy white shells, matte cream chevron bands, " +
      "warm tan podium, dark glazing beneath the shells, " + TAIL,
  },
  {
    // The color story — interlocking prismatic massing, proven live in-app.
    // Tuned to Bofill's real scheme + the aerial reference: VERTICAL walls in
    // reds + pinks vs HORIZONTAL terraces/stairs in blues + violets, sunken
    // blue pool, cypress trees. Revised AGAIN after a forge read too square/
    // blocky — dropped "monolithic … solid plinth/fortress" (those forced a
    // cube) for an ARTICULATED notched cross-plan of varying-height volumes and
    // a labyrinth of external stairs at many levels.
    label: "La Muralla Roja",
    prompt:
      "La Muralla Roja Calpe Ricardo Bofill, LEGO Architecture set, a cluster " +
      "of interlocking Greek-cross towers fused into one connected massing " +
      "with a deeply notched, stepped silhouette, projecting and recessed " +
      "cubic volumes at varying heights and re-entrant corners cut deep into a " +
      "cross-shaped plan, deep open courtyards, a sunken blue pool and a " +
      "labyrinth of external staircases zig-zagging between the volumes at many " +
      "levels, smooth dark red and coral plastic bricks, crisp parapet edges, " +
      "vertical slot windows and crenellated stepped rooflines, the vertical " +
      "walls in reds and pinks against blue and violet horizontal terraces and " +
      "stairs, interlocked cruciform massing on a slim dark display base, deep " +
      "red and coral outer walls, soft pink inner courtyard faces, medium blue " +
      "and sand blue rooftop terraces and pool, medium lavender stairs, dark " +
      "green cypress trees on the terraces, " + TAIL,
  },
  {
    // The metallic curve. Gehry's titanium volumes read as one fused sculptural
    // body around the glass atrium — wording leans hard on "fused/continuous"
    // so the smooth deconstructivist curves survive voxelization at 32 studs.
    label: "Guggenheim Bilbao",
    prompt:
      "Guggenheim Museum Bilbao Frank Gehry, LEGO Architecture set, " +
      "interconnected swirling titanium-clad volumes fused around a tall " +
      "central glass atrium, overlapping curved ship-like masses merging " +
      "into one continuous sculptural body, smooth metallic silver and light " +
      "bluish grey plastic bricks, rippling overlapping metallic panel " +
      "cladding with soft curved reflective folds, long stepped limestone " +
      "plinth along the waterfront, metallic silver titanium curves, light " +
      "bluish grey shadow folds, tan limestone base, trans-clear glazed " +
      "atrium, " + TAIL,
  },
  {
    // The multicolor pick — the set's only candy-bright palette. Domes ride on
    // STOUT drums on a shared fused gallery so the slim onion necks don't pinch
    // off in voxelization. Tuned to the references: a red-brick central TENT
    // crowned with a small gold dome, every onion dome uniquely coloured +
    // patterned (the iconic blue-and-white spiral stripe, green/gold twists,
    // diamond-lattice facets), green gallery roofs, white kokoshnik gables.
    label: "Saint Basil's Cathedral",
    prompt:
      "Saint Basil's Cathedral Moscow Red Square, LEGO Architecture set, eight " +
      "onion-domed chapels of differing heights clustered symmetrically around " +
      "a taller central red-brick tented tower crowned with a small golden " +
      "onion dome and cross, all fused onto one shared raised gallery, bulbous " +
      "onion domes on stout cylindrical drums, smooth red and white plastic " +
      "bricks, each dome uniquely coloured and patterned — twisted spirals, " +
      "vertical stripes and diamond-lattice facets, no two alike — over " +
      "red-and-white patterned walls with white blind arcades and stacked " +
      "pointed kokoshnik gables, raised arcaded gallery podium with covered " +
      "staircases and green gallery roofs, scarlet red brick walls, white " +
      "trim, one blue-and-white spiral-striped dome, dark green, golden yellow " +
      "and orange spiral domes, pearl gold central cupola, " + TAIL,
  },
  {
    // The ancient monolith. One continuous fused oval ring with a thick solid
    // wall so the amphitheatre ring reads as a single connected mass, not a
    // thin hoop that breaks under reconstruction.
    label: "Colosseum",
    prompt:
      "Colosseum Rome Flavian Amphitheatre, LEGO Architecture set, massive " +
      "elliptical amphitheatre as one continuous fused oval ring of four " +
      "stacked stone arcades, thick solid outer wall stepping down where it " +
      "is ruined, enclosing the tiered arena, smooth tan and dark tan " +
      "plastic bricks, repeating tiered round-arch arcades with engaged " +
      "columns and regular rows of arched openings, solid stepped stone " +
      "foundation ring, tan travertine stone, dark tan weathered shadows, " +
      "reddish brown ruined breaks, light bluish grey arena floor, " + TAIL,
  },
];
