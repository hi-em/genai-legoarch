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
    // completed basilica, all 18 towers, deliberately unified tan stone.
    label: "Sagrada Família",
    prompt:
      "Sagrada Família Barcelona Antoni Gaudí, LEGO Architecture set, " +
      "longitudinal basilica with eighteen clustered tapering openwork towers " +
      "fused into the nave body, four-tower clusters over three sculpted " +
      "facades and a taller central tower group, smooth tan and dark tan " +
      "plastic bricks, intricate carved-stone filigree texture with deep " +
      "portal recesses, stepped apse and solid podium base, tan stone " +
      "throughout, dark tan shadow details, translucent crystal pinnacle " +
      "tips, stained-glass color accents, " + TAIL,
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
    label: "La Muralla Roja",
    prompt:
      "La Muralla Roja Calpe Ricardo Bofill, LEGO Architecture set, " +
      "interlocking Greek-cross towers forming a stepped casbah-like " +
      "fortress around inner courtyards, rooftop terraces with external " +
      "staircases descending between volumes, smooth dark red and coral " +
      "plastic bricks, repeating vertical slot openings and crisp parapet " +
      "edges, monolithic interlocked massing on a solid plinth, dark red " +
      "outer walls, coral pink courtyards, medium lavender and sand blue " +
      "stairwells, " + TAIL,
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
    // off in voxelization.
    label: "Saint Basil's Cathedral",
    prompt:
      "Saint Basil's Cathedral Moscow Red Square, LEGO Architecture set, " +
      "nine onion-domed chapels clustered symmetrically around a tall central " +
      "tented spire, all fused onto one shared raised gallery, bulbous domes " +
      "on stout cylindrical drums, smooth red and white plastic bricks, " +
      "candy-striped spiral and faceted onion domes with patterned brickwork " +
      "and pointed arched gables, raised arcaded gallery podium with covered " +
      "staircases, scarlet red brick walls, white trim, dark green, blue, " +
      "golden yellow and orange spiral domes, pearl gold cupola tips, " + TAIL,
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
