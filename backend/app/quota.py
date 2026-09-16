"""Spend control for hosted generation: per-user daily forges + a global monthly budget.

Every hosted image or mesh costs real money (docs/hosted-generation.md §4:
~$0.08 and ~$0.25). Cloud Run has no rate limiter of its own and Cloud Armor
needs a load balancer, so the first line of defence is here, in front of every
provider call; Google's spend-cap budget and the prepaid fal balance are the
backstops (§5.2).

Two counters, both checked BEFORE the call and incremented only on success:

    users/{uid}/quota/{YYYY-MM-DD}   {images, meshes}   per person, per UTC day
    quota/{YYYY-MM}                  {spentUsd}          everyone, per month

The per-user document is a NEW piece of stored data about an account (a count
and a date). The consent text in frontend/src/auth/SignInPanel.jsx and
frontend/public/privacy.html name it — keep them in step with this file.

Local development (no GOOGLE_CLOUD_PROJECT) keeps the same counters in
backend/.localshelf/quota.json so the gate can be exercised without GCP.

Env:
  HOSTED_USER_DAILY_IMAGES   default 3   renders per person per day
  HOSTED_USER_DAILY_MESHES   default 3   meshes per person per day
  HOSTED_MONTHLY_BUDGET_USD  default 10  hard stop for everyone, per calendar month
  HOSTED_COST_IMAGE_USD      default 0.08  (Gemini 3.1 Flash Image, EU endpoint, rounded up)
  HOSTED_COST_MESH_USD       default 0.25  (Hunyuan3D 3.1 Rapid on fal, rounded up)
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from . import shelf_store

USER_DAILY = {
    "image": int(os.environ.get("HOSTED_USER_DAILY_IMAGES", "3")),
    "mesh": int(os.environ.get("HOSTED_USER_DAILY_MESHES", "3")),
}
MONTHLY_BUDGET_USD = float(os.environ.get("HOSTED_MONTHLY_BUDGET_USD", "10"))
COST_USD = {
    "image": float(os.environ.get("HOSTED_COST_IMAGE_USD", "0.08")),
    "mesh": float(os.environ.get("HOSTED_COST_MESH_USD", "0.25")),
}
_FIELD = {"image": "images", "mesh": "meshes"}

_lock = threading.Lock()


def _day(now: float | None = None) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(now if now is not None else time.time()))


def _month(now: float | None = None) -> str:
    return time.strftime("%Y-%m", time.gmtime(now if now is not None else time.time()))


def limits() -> dict[str, Any]:
    """Static configuration, for /api/capabilities (no per-user data)."""
    return {"userDailyImages": USER_DAILY["image"], "userDailyMeshes": USER_DAILY["mesh"],
            "monthlyBudgetUsd": MONTHLY_BUDGET_USD}


class QuotaExceeded(HTTPException):
    def __init__(self, code: str, **extra: Any):
        super().__init__(status_code=429, detail={"code": code, **extra})


# ---------- local (JSON file) ----------
def _local_path() -> Path:
    return shelf_store.LOCAL_DIR / "quota.json"


def _local_read() -> dict[str, Any]:
    p = _local_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _local_write(data: dict[str, Any]) -> None:
    p = _local_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _local_check_and_add(uid: str, stage: str, now: float) -> dict[str, Any]:
    with _lock:
        data = _local_read()
        user_key = f"user:{uid}:{_day(now)}"
        month_key = f"month:{_month(now)}"
        user = data.get(user_key, {})
        month = data.get(month_key, {"spentUsd": 0.0})
        _check(user, month, stage)
        user[_FIELD[stage]] = user.get(_FIELD[stage], 0) + 1
        month["spentUsd"] = round(month.get("spentUsd", 0.0) + COST_USD[stage], 4)
        data[user_key], data[month_key] = user, month
        _local_write(data)
        return {"user": user, "month": month}


# ---------- Firestore ----------
def _cloud_check_and_add(uid: str, stage: str, now: float) -> dict[str, Any]:
    from google.cloud import firestore

    db = shelf_store._firestore()
    user_ref = db.collection("users").document(uid).collection("quota").document(_day(now))
    month_ref = db.collection("quota").document(_month(now))

    @firestore.transactional
    def txn(transaction):
        user = user_ref.get(transaction=transaction).to_dict() or {}
        month = month_ref.get(transaction=transaction).to_dict() or {"spentUsd": 0.0}
        _check(user, month, stage)
        user[_FIELD[stage]] = user.get(_FIELD[stage], 0) + 1
        user["updatedAt"] = now
        month["spentUsd"] = round(month.get("spentUsd", 0.0) + COST_USD[stage], 4)
        month["updatedAt"] = now
        transaction.set(user_ref, user)
        transaction.set(month_ref, month)
        return {"user": user, "month": month}

    return txn(db.transaction())


# ---------- shared ----------
def _check(user: dict[str, Any], month: dict[str, Any], stage: str) -> None:
    if month.get("spentUsd", 0.0) + COST_USD[stage] > MONTHLY_BUDGET_USD:
        raise QuotaExceeded("monthly_budget", budgetUsd=MONTHLY_BUDGET_USD)
    if user.get(_FIELD[stage], 0) >= USER_DAILY[stage]:
        raise QuotaExceeded("user_daily_limit", stage=stage, limit=USER_DAILY[stage])


def forget_user(uid: str) -> int:
    """Erase a user's daily counters. Part of "Delete my account".

    Firestore does not delete a document's subcollections with it, so
    shelf_store.delete_user calls this explicitly — otherwise the counter
    would outlive the account the privacy page says is gone. The global
    monthly spend is not touched: it is not about a person. Returns how many
    day records were removed.
    """
    if shelf_store.cloud_enabled():
        col = shelf_store._firestore().collection("users").document(uid).collection("quota")
        n = 0
        for doc in col.stream():
            doc.reference.delete()
            n += 1
        return n
    with _lock:
        data = _local_read()
        gone = [k for k in data if k.startswith(f"user:{uid}:")]
        for k in gone:
            del data[k]
        if gone:
            _local_write(data)
        return len(gone)


def reserve(uid: str, stage: str, now: float | None = None) -> dict[str, Any]:
    """Count one `stage` call ("image" | "mesh") for `uid`, or raise 429.

    Counted before the provider call, so a call that then fails still costs a
    slot — better a lost slot than an unbounded retry loop spending money.
    """
    if stage not in COST_USD:
        raise ValueError(f"unknown stage {stage!r}")
    now = now if now is not None else time.time()
    if shelf_store.cloud_enabled():
        return _cloud_check_and_add(uid, stage, now)
    return _local_check_and_add(uid, stage, now)
