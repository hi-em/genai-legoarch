"""Turn a short building name into a rich legoarch-style prompt.

The `legoarch` LoRA trigger word is NOT included here — the caller concatenates
it (the txt2img graph has a StringConcatenate node; img2img prepends in code).
So this returns just the descriptive prompt body.

If ANTHROPIC_API_KEY is set, Claude expands the subject into the detailed
LEGO-Architecture style; otherwise a deterministic template is used so the app
still works offline.
"""
from __future__ import annotations

import os

# Constant studio/product-photo tail shared by all prompts (from the reference).
STYLE_SUFFIX = (
    "standalone model on dark display base, white background, elevated 3/4 angle, "
    "product photography, studio lighting, official LEGO set photography"
)

# The reference exemplar the Claude enhancer imitates. Deliberately PRISMATIC
# (stacked/terraced massing, opaque named LEGO colours): translucent or
# hair-thin forms render beautifully but shred in the TRELLIS reconstruction
# and the ~32-stud voxelization downstream. (The old Fondation Louis Vuitton
# reference lives on in docs/benchmarks.md as the documented stress case.)
_REFERENCE = (
    "Habitat 67 Montreal Moshe Safdie, LEGO Architecture set, stacked offset concrete "
    "cube modules forming a terraced pyramidal hill, smooth light bluish grey and tan "
    "plastic bricks, repeating modular box pattern with recessed terrace openings, "
    "cantilevered cubic clusters over a solid podium, light bluish grey volumes, tan "
    "terrace insets, dark grey shadow gaps, " + STYLE_SUFFIX
)

_SYSTEM = (
    "You write a single image-generation prompt for a LEGO-Architecture-style model. "
    "Given a building or subject, expand it into ONE richly detailed prompt that describes "
    "it as a LEGO Architecture set: the overall massing and form, the smooth plastic brick "
    "materials and surface patterns, a specific named colour palette, and finishing with "
    "studio product-photography descriptors. Match the structure and tone of this reference "
    "exactly:\n\n" + _REFERENCE + "\n\n"
    "Constraints (the image feeds a 3D-reconstruction + voxelization pipeline): favor "
    "monolithic, stacked, or terraced massing described as a single connected volume; use "
    "real LEGO colour names (light bluish grey, dark bluish grey, tan, sand green, dark "
    "red, bright white, reddish brown); never include people, vehicles, trees, water, "
    "landscape context, flags, antennas, or thin spires; avoid translucent or glass-heavy "
    "descriptions.\n\n"
    "Output ONLY the prompt text: one line, no quotes, no leading 'legoarch', no preamble."
)

_MODEL = "claude-haiku-4-5-20251001"


def _strip_trigger(subject: str) -> str:
    subject = (subject or "").strip()
    if subject.lower().startswith("legoarch"):
        subject = subject[len("legoarch"):].lstrip(" ,")
    return subject


def _template(subject: str) -> str:
    return f"{subject}, LEGO Architecture set, smooth plastic bricks, {STYLE_SUFFIX}"


def _ensure_suffix(text: str) -> str:
    """Make sure the studio product-photo tail is present (don't double it)."""
    if "official LEGO set photography" in text:
        return text
    return f"{text.rstrip(', ')}, {STYLE_SUFFIX}"


def _is_rich(subject: str) -> bool:
    """A prompt that already follows the full LEGO-Architecture structure — pass
    it through verbatim rather than re-wrapping (e.g. the example prompts)."""
    return "lego architecture set" in subject.lower() or len(subject) > 140


def enhance_prompt(subject: str) -> str:
    """Return a rich legoarch-style prompt body (no trigger word)."""
    subject = _strip_trigger(subject) or "modern architecture building"

    # already-detailed prompts (the example chips, or anything a user writes in
    # full) are used as-is — just guarantee the studio tail.
    if _is_rich(subject):
        return _ensure_suffix(subject)

    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=key)
            msg = client.messages.create(
                model=_MODEL,
                max_tokens=400,
                system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": subject}],
            )
            text = "".join(
                b.text for b in msg.content if getattr(b, "type", None) == "text"
            ).strip()
            if text:
                return _strip_trigger(text)
        except Exception:
            # any SDK / network / auth issue -> fall back to the template
            pass

    return _template(subject)
