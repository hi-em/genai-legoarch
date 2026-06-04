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

_REFERENCE = (
    "Fondation Louis Vuitton Paris Frank Gehry, LEGO Architecture set, multiple billowing "
    "curved glass sail forms arching over white concrete base, smooth translucent light grey "
    "and pearl white plastic bricks, overlapping curved canopy sails with ribbed surface "
    "pattern, angular deconstructivist white base volumes beneath, light grey translucent "
    "sail panels, bright white concrete base, silver grey structural ribs, " + STYLE_SUFFIX
)

_SYSTEM = (
    "You write a single image-generation prompt for a LEGO-Architecture-style model. "
    "Given a building or subject, expand it into ONE richly detailed prompt that describes "
    "it as a LEGO Architecture set: the overall massing and form, the smooth plastic brick "
    "materials and surface patterns, a specific named colour palette, and finishing with "
    "studio product-photography descriptors. Match the structure and tone of this reference "
    "exactly:\n\n" + _REFERENCE + "\n\n"
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


def enhance_prompt(subject: str) -> str:
    """Return a rich legoarch-style prompt body (no trigger word)."""
    subject = _strip_trigger(subject) or "modern architecture building"

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
