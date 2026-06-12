// The four example chips — research-grounded prompts (docs sources: LEGO 21065
// press/product pages, sydneyoperahouse.com spherical-solution archive, Arup
// 1973 engineering paper, villa-savoye.fr monument site; see the deep-research
// session 2026-06-12). Each follows the 8-slot grammar the benchmark validated:
//   [identity] [LEGO Architecture set] [massing, FUSED verbs + counts]
//   [smooth X+Y plastic bricks] [signature pattern] [base volume]
//   [named LEGO palette WITH placement] [studio tail]
// Massing language keeps volumes fused and grounded (matching LEGO's own
// design choices in 21065/21012/21014) so the TRELLIS mesh voxelizes into a
// single connected build. Habitat 67 remains the internal enhancement
// reference in backend/app/prompt_enhance.py — it is not a chip.
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
    // "A box in the air" (villa-savoye.fr): white prism over a recessed
    // English-green ground floor — the legolizer's easiest A+.
    label: "Villa Savoye",
    prompt:
      "Villa Savoye Poissy Le Corbusier, LEGO Architecture set, crisp white " +
      "rectangular prism floating above a recessed dark green ground floor " +
      "with slender white pilotis, continuous horizontal ribbon windows " +
      "wrapping all four elevations, curved white rooftop solarium " +
      "windbreak, smooth white and sand green plastic bricks, clean " +
      "modernist planes with precise window-strip reveals, white box volume, " +
      "sand green recessed base, trans-clear ribbon glazing, light bluish " +
      "grey terrace details, " + TAIL,
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
];
