"""Google Sign-In: verify an ID token, hand back our own session cookie.

Why not just send Google's ID token on every request? It expires after an hour,
so the shelf would start 401-ing mid-session and the user would be bounced to
the sign-in gate while looking at their own collection. Instead the token is
verified ONCE, at sign-in, and exchanged for a session cookie we sign
ourselves. Stateless (nothing in memory), so a Cloud Run revision can scale to
zero and back without logging anyone out.

Env:
  GOOGLE_CLIENT_ID   OAuth 2.0 Web client ID — REQUIRED for sign-in to work
  SESSION_SECRET     signing key for the session cookie (Secret Manager)
  SESSION_DAYS       cookie lifetime, default 30
  REVIEWER_EMAILS    comma-separated allowlist, see `is_reviewer`
"""
from __future__ import annotations

import hashlib
import os
import time
from typing import Any, Optional

from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

COOKIE_NAME = "legoarch_session"
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "30"))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


def _secret() -> str:
    """The cookie signing key.

    In production this MUST come from the environment (Secret Manager). Local
    dev gets a stable machine-local fallback so `uvicorn` runs with no setup —
    it is derived, not random, so restarting the server doesn't invalidate the
    cookie you just got.
    """
    s = os.environ.get("SESSION_SECRET")
    if s:
        return s
    if os.environ.get("K_SERVICE"):        # set by Cloud Run — never guess there
        raise RuntimeError("SESSION_SECRET is required in production")
    return hashlib.sha256(b"legoarch-local-dev-session-key").hexdigest()


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(_secret(), salt="legoarch.session")


# ---------- sign-in ----------
def verify_google_token(id_token_str: str) -> dict[str, Any]:
    """Verify a Google ID token and return the claims we keep.

    Raises HTTPException(401) on anything suspect. Verification is done by
    google-auth against Google's public certs — never by decoding the token
    ourselves, which would accept a forged one.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail={"code": "auth_not_configured"})

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=401, detail={"code": "bad_token"})

    # verify_oauth2_token checks aud/exp/signature; the issuer check is ours.
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail={"code": "bad_issuer"})
    if not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail={"code": "email_unverified"})

    return {
        "uid": claims["sub"],                       # Google's stable user id
        "email": claims.get("email", ""),
        "name": claims.get("name", "") or claims.get("given_name", ""),
        "picture": claims.get("picture", ""),
    }


def issue_session(response: Response, user: dict[str, Any]) -> None:
    """Sign the user into a cookie. HttpOnly so page scripts can't read it."""
    token = _serializer().dumps({"uid": user["uid"], "email": user["email"]})
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        # Cloud Run is always HTTPS; local dev is not, and a Secure cookie would
        # simply never be sent back over http://localhost.
        secure=bool(os.environ.get("K_SERVICE")),
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


# ---------- reading the session back ----------
def optional_user(request: Request) -> Optional[dict[str, Any]]:
    """The signed-in user, or None. Never raises — use for public routes."""
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        return None
    try:
        data = _serializer().loads(raw, max_age=SESSION_DAYS * 24 * 3600)
    except (BadSignature, SignatureExpired):
        return None
    return data if isinstance(data, dict) and data.get("uid") else None


def require_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency for routes that need a signed-in user."""
    user = optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail={"code": "not_signed_in"})
    return user


CurrentUser = Depends(require_user)


def is_reviewer(email: str) -> bool:
    """Is this address on the reviewer allowlist?

    The site requires sign-in to enter, which means a marker or an external
    reviewer cannot see the project without a Google account. REVIEWER_EMAILS
    exists so specific people can be let through without loosening the gate for
    everyone. Currently informational — the gate does not treat them
    differently — but it is the hook to hang that on.
    """
    allow = {e.strip().lower() for e in os.environ.get("REVIEWER_EMAILS", "").split(",") if e.strip()}
    return email.strip().lower() in allow


def profile_for(claims: dict[str, Any]) -> dict[str, Any]:
    """The user record we persist. Deliberately minimal — identity only.

    No prompts, no dial settings, no timings: the consent shown at the gate
    covers storing an account and the sets the user chooses to save, and this
    function is what keeps that promise honest.
    """
    return {
        "uid": claims["uid"],
        "email": claims["email"],
        "name": claims["name"],
        "picture": claims["picture"],
        "lastSeen": time.time(),
    }
