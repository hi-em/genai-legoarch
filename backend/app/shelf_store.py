"""The cloud shelf: a user's saved sets, server-side.

Storage is split on purpose. A saved set carries its whole `brickModel`, and a
detail-48 build is tens of thousands of bricks — several MB of JSON (see the
note above SHELF_KEY in frontend/src/state/store.js). Firestore caps a document
at 1 MiB, so the flagship sets are exactly the ones that would fail to save.

    Firestore  users/{uid}/sets/{id}   the light index — title, counts, thumbs
    Storage    sets/{uid}/{id}.json.gz the heavy payload — brickModel, setCopy

The index is what the Collection screen lists (cheap, one query); the payload is
fetched only when a set is actually opened.

Local development needs neither: with no GOOGLE_CLOUD_PROJECT the whole thing
falls back to a directory under backend/.localshelf, so the sign-in flow and the
shelf can be exercised on a laptop with no GCP project at all.

Env:
  GOOGLE_CLOUD_PROJECT   enables Firestore + Storage (set for you on Cloud Run)
  SHELF_BUCKET           payload bucket, default "<project>-legoarch-sets"
"""
from __future__ import annotations

import gzip
import json
import os
import time
from pathlib import Path
from typing import Any, Optional

SHELF_CAP = 20          # mirrors the frontend cap — a shelf is a shelf, not a database

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
BUCKET = os.environ.get("SHELF_BUCKET", f"{PROJECT}-legoarch-sets" if PROJECT else "")
LOCAL_DIR = Path(__file__).resolve().parents[1] / ".localshelf"

# Fields that live in the Firestore index. Everything else in a set — the
# brickModel above all — goes to the payload blob.
INDEX_FIELDS = ("id", "title", "setNumber", "nBricks", "thumb", "renderThumb", "savedAt")


def cloud_enabled() -> bool:
    return bool(PROJECT)


# ---------- clients (lazy: importing google.cloud costs ~1s of cold start) ----------
_fs = None
_gcs = None


def _firestore():
    global _fs
    if _fs is None:
        from google.cloud import firestore

        _fs = firestore.Client(project=PROJECT)
    return _fs


def _bucket():
    global _gcs
    if _gcs is None:
        from google.cloud import storage

        _gcs = storage.Client(project=PROJECT).bucket(BUCKET)
    return _gcs


# ---------- payload blob ----------
def _payload_path(uid: str, set_id: str) -> str:
    return f"sets/{uid}/{set_id}.json.gz"


def _write_payload(uid: str, set_id: str, payload: dict[str, Any]) -> None:
    raw = gzip.compress(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    if cloud_enabled():
        blob = _bucket().blob(_payload_path(uid, set_id))
        blob.upload_from_string(raw, content_type="application/gzip")
        return
    p = LOCAL_DIR / _payload_path(uid, set_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(raw)


def _read_payload(uid: str, set_id: str) -> Optional[dict[str, Any]]:
    if cloud_enabled():
        blob = _bucket().blob(_payload_path(uid, set_id))
        if not blob.exists():
            return None
        raw = blob.download_as_bytes()
    else:
        p = LOCAL_DIR / _payload_path(uid, set_id)
        if not p.exists():
            return None
        raw = p.read_bytes()
    return json.loads(gzip.decompress(raw).decode("utf-8"))


def _delete_payload(uid: str, set_id: str) -> None:
    if cloud_enabled():
        blob = _bucket().blob(_payload_path(uid, set_id))
        if blob.exists():
            blob.delete()
        return
    p = LOCAL_DIR / _payload_path(uid, set_id)
    p.unlink(missing_ok=True)


# ---------- index ----------
def _index_dir(uid: str) -> Path:
    return LOCAL_DIR / "index" / uid


def _write_index(uid: str, entry: dict[str, Any]) -> None:
    if cloud_enabled():
        _firestore().collection("users").document(uid).collection("sets").document(
            entry["id"]
        ).set(entry)
        return
    d = _index_dir(uid)
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{entry['id']}.json").write_text(json.dumps(entry), encoding="utf-8")


def _read_index(uid: str) -> list[dict[str, Any]]:
    if cloud_enabled():
        docs = _firestore().collection("users").document(uid).collection("sets").stream()
        entries = [d.to_dict() for d in docs]
    else:
        d = _index_dir(uid)
        entries = [
            json.loads(f.read_text(encoding="utf-8")) for f in d.glob("*.json")
        ] if d.exists() else []
    # newest first — the shelf reads as a timeline
    entries.sort(key=lambda e: e.get("savedAt", 0), reverse=True)
    return entries


def _delete_index(uid: str, set_id: str) -> None:
    if cloud_enabled():
        _firestore().collection("users").document(uid).collection("sets").document(
            set_id
        ).delete()
        return
    (_index_dir(uid) / f"{set_id}.json").unlink(missing_ok=True)


# ---------- public API ----------
def touch_user(profile: dict[str, Any]) -> None:
    """Record that this user exists and signed in. Identity only."""
    if not cloud_enabled():
        d = LOCAL_DIR / "users"
        d.mkdir(parents=True, exist_ok=True)
        (d / f"{profile['uid']}.json").write_text(json.dumps(profile), encoding="utf-8")
        return
    _firestore().collection("users").document(profile["uid"]).set(profile, merge=True)


def list_sets(uid: str) -> list[dict[str, Any]]:
    """The index only — enough to render the Collection, without the payloads."""
    return _read_index(uid)


def get_set(uid: str, set_id: str) -> Optional[dict[str, Any]]:
    """One full set: index fields + payload, recombined."""
    payload = _read_payload(uid, set_id)
    if payload is None:
        return None
    entry = next((e for e in _read_index(uid) if e.get("id") == set_id), {})
    return {**entry, **payload}


def save_set(uid: str, item: dict[str, Any]) -> dict[str, Any]:
    """Upsert one set. Returns {saved, dropped}.

    Same-title sets replace in place, matching the local shelf's rule: re-tuning
    a building is a new version of it, not a second copy.
    """
    set_id = str(item.get("id") or "").strip()
    if not set_id:
        raise ValueError("set needs an id")

    existing = _read_index(uid)
    title = (item.get("title") or "").strip().lower()
    same = next(
        (e for e in existing if (e.get("title") or "").strip().lower() == title and title),
        None,
    )
    if same and same["id"] != set_id:
        # a new version of a building already on the shelf — retire the old id so
        # the shelf shows one entry, not two, and the old payload doesn't leak
        _delete_index(uid, same["id"])
        _delete_payload(uid, same["id"])
        existing = [e for e in existing if e["id"] != same["id"]]

    entry = {k: item.get(k) for k in INDEX_FIELDS if k in item}
    entry["id"] = set_id
    entry.setdefault("savedAt", time.time())

    payload = {k: v for k, v in item.items() if k not in INDEX_FIELDS}
    _write_payload(uid, set_id, payload)
    _write_index(uid, entry)

    # enforce the cap by dropping the OLDEST, never the one just saved
    dropped = 0
    remaining = [e for e in existing if e["id"] != set_id]
    overflow = len(remaining) + 1 - SHELF_CAP
    if overflow > 0:
        for stale in sorted(remaining, key=lambda e: e.get("savedAt", 0))[:overflow]:
            _delete_index(uid, stale["id"])
            _delete_payload(uid, stale["id"])
            dropped += 1

    return {"saved": True, "dropped": dropped, "entry": entry}


def delete_set(uid: str, set_id: str) -> None:
    _delete_index(uid, set_id)
    _delete_payload(uid, set_id)
