"""The 'set designer' persona — names the set and writes the box copy.

Playful but credible: dry catalog-copy wit that never undercuts the serious
computational-architecture thesis. If ANTHROPIC_API_KEY is set, Claude writes
it; otherwise a deterministic, characterful template runs so the app works
offline. Either way it returns the same JSON shape the trophies consume.
"""
from __future__ import annotations

import json
import os
import random
from typing import Any

_MODEL = "claude-sonnet-4-6"  # box copy is short + infrequent; quality over cost

_SYSTEM = (
    "You are the set designer and catalogue copywriter for 'lEgoarCh', an "
    "architecture-themed generative LEGO line made by two computational-architecture "
    "students. Voice: dry, witty, quietly proud — official-LEGO-catalogue cadence with "
    "an architect's deadpan. Never childish, never undercut the engineering. Given a "
    "subject building and the solved set's stats, return ONLY a JSON object with keys: "
    "set_name (the recognisable building name, title case), "
    "set_number (a 5-digit string starting 21, LEGO-Architecture style), "
    "box_blurb (1-2 sentences, back-of-box), "
    "designer_quote (one dry line, attributed to '— the lEgoarCh studio'), "
    "value_verdict (one short line referencing the piece count or stability), "
    "share_tagline (a punchy <8-word line for socials). No prose outside the JSON."
)

_FIELDS = ("set_name", "set_number", "box_blurb", "designer_quote", "value_verdict", "share_tagline")


def _clean_subject(subject: str) -> str:
    s = (subject or "").strip()
    if s.lower().startswith("legoarch"):
        s = s[len("legoarch"):].lstrip(" ,")
    return s.split(",")[0].strip() or "Untitled Structure"


# ---- deterministic offline copy ------------------------------------------------
_ADJ = ["billowing", "uncompromising", "improbable", "cantilevered", "monolithic",
        "weightless", "rigorous", "sculptural", "defiant", "serene"]
_SERIES = ["Modern Landmarks", "Architect's Edition", "Computational Series",
           "Built Environment", "Form & Force"]


def _template(subject: str, st: dict[str, Any]) -> dict[str, str]:
    name = _clean_subject(subject)
    rng = random.Random(hash(name) & 0xFFFFFFFF)
    n = int(st.get("n_bricks", 0))
    parts = int(st.get("n_parts", n))
    colors = int(st.get("n_colors", 0))
    support = float(st.get("support_ratio", 1.0))
    connected = bool(st.get("connected", True))
    adj = rng.choice(_ADJ)
    series = rng.choice(_SERIES)
    number = f"21{rng.randint(0, 999):03d}"

    blurb = (
        f"Recreate the {adj} form of {name} in {n:,} precision-placed bricks. "
        f"Solved course by course, every footprint is a real, buildable LEGO part."
    )
    quote = rng.choice([
        f"“We didn’t design {name}. We just proved it stacks.” — the lEgoarCh studio",
        f"“The curve was the architect’s problem. The bond was ours.” — the lEgoarCh studio",
        f"“{n:,} bricks, zero glue, one opinion.” — the lEgoarCh studio",
    ])
    if connected and support >= 0.95:
        verdict = f"{n:,} pieces and it stands on its own — no cheating."
    elif connected:
        verdict = f"{n:,} pieces, one connected build, {round(support * 100)}% self-supported."
    else:
        verdict = f"{n:,} pieces — ambitious overhangs; a few hidden supports recommended."
    tagline = rng.choice([
        f"{name}, in {n:,} bricks.",
        f"Generated. Solved. Buildable.",
        f"{colors} colours. {parts} parts. One landmark.",
    ])
    return {
        "set_name": name,
        "set_number": number,
        "series": series,
        "box_blurb": blurb,
        "designer_quote": quote,
        "value_verdict": verdict,
        "share_tagline": tagline,
    }


def generate_set_copy(payload: dict[str, Any]) -> dict[str, str]:
    """Return box/share copy for a solved set. `payload` carries subject + stats."""
    subject = payload.get("subject", "")
    fallback = _template(subject, payload)

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return fallback
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=key)
        user = json.dumps({
            "subject": _clean_subject(subject),
            "n_bricks": payload.get("n_bricks"),
            "n_parts": payload.get("n_parts"),
            "n_colors": payload.get("n_colors"),
            "grid": payload.get("grid"),
            "support_ratio": payload.get("support_ratio"),
            "connected": payload.get("connected"),
        })
        msg = client.messages.create(
            model=_MODEL,
            max_tokens=500,
            system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text").strip()
        # tolerate a fenced code block
        if text.startswith("```"):
            text = text.strip("`").split("\n", 1)[-1].rsplit("```", 1)[0]
        data = json.loads(text)
        # fill any missing key from the deterministic fallback
        return {**fallback, **{k: data[k] for k in _FIELDS if k in data and data[k]}}
    except Exception:
        return fallback
