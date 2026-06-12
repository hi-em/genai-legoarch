// The 8-slot legoarch prompt grammar — frontend mirror.
// Source of truth: backend/app/prompt_grammar.json (edit there, then run
// `node scripts/sync_grammar.mjs`). Consumed by the loading theater's
// anatomy card and the render-stop RecipeCard's hover-explained chips.
import grammar from "./promptGrammar.gen.json";

export const GRAMMAR = grammar;
export const STYLE_SUFFIX = grammar.style_suffix;

// chip tones (shared by LoadingTheater + RecipeCard)
export const TONE = {
  yellow: "bg-brand-yellow/15 text-brand-yellow",
  blue: "bg-brand-blue/20 text-sky-300",
  red: "bg-brand-red/20 text-red-300",
  neutral: "bg-white/10 text-on-dark-muted",
};

const matchers = grammar.slots.map((s) => ({
  ...s,
  re: s.match?.pattern ? new RegExp(s.match.pattern, "i") : null,
}));

/**
 * Parse an ENHANCED prompt into ordered grammar slots.
 * Returns [{ id, name, text, tone, ui_hint }]; the trigger chip is always
 * prepended. Slots may swallow several comma-segments (massing phrases,
 * the palette's colour list, the whole studio tail).
 */
export function parsePromptSlots(enhancedPrompt) {
  if (!enhancedPrompt || typeof enhancedPrompt !== "string") return [];
  const segs = enhancedPrompt.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  if (!segs.length) return [];

  const out = [
    {
      id: "trigger",
      name: "Trigger",
      text: grammar.trigger.token,
      tone: grammar.trigger.tone,
      ui_hint: grammar.trigger.ui_hint,
    },
  ];

  // strip a leading trigger token if the caller included it
  if (segs[0]?.toLowerCase().startsWith(grammar.trigger.token)) {
    segs[0] = segs[0].slice(grammar.trigger.token.length).trim();
    if (!segs[0]) segs.shift();
  }
  if (!segs.length) return out;

  // identity = first segment, always
  const identity = matchers.find((m) => m.id === "identity");
  out.push({ id: identity.id, name: identity.name, text: segs.shift(), tone: identity.tone, ui_hint: identity.ui_hint });

  // studio tail = trailing segments that match its patterns, joined
  const tail = matchers.find((m) => m.id === "studio_tail");
  const tailParts = [];
  while (segs.length && tail.re?.test(segs[segs.length - 1])) {
    tailParts.unshift(segs.pop());
  }

  // middle segments: walk the slot order greedily; a segment that matches a
  // LATER slot advances to it, a non-matching segment extends the current one
  const middle = matchers.filter((m) => !["identity", "studio_tail"].includes(m.id));
  let cursor = 0;
  let current = null;
  for (const seg of segs) {
    let advanced = false;
    for (let i = cursor; i < middle.length; i++) {
      if (middle[i].re?.test(seg)) {
        if (current && i === cursor && current.id === middle[i].id) {
          current.text += `, ${seg}`;          // same slot continues (palette lists…)
        } else {
          current = { id: middle[i].id, name: middle[i].name, text: seg, tone: middle[i].tone, ui_hint: middle[i].ui_hint };
          out.push(current);
          cursor = i;
        }
        advanced = true;
        break;
      }
    }
    if (!advanced) {
      if (current) current.text += `, ${seg}`; // unmatched: extend the phrase
      else {
        current = { id: "massing", name: "Massing", text: seg, tone: "red", ui_hint: matchers.find((m) => m.id === "massing").ui_hint };
        out.push(current);
        cursor = Math.max(cursor, 1);
      }
    }
  }

  if (tailParts.length) {
    out.push({ id: tail.id, name: tail.name, text: tailParts.join(", "), tone: tail.tone, ui_hint: tail.ui_hint });
  }
  return out;
}
