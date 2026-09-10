"""Sign-in gate + the cloud shelf.

Google's own verification is stubbed — what is under test is OUR half: that the
session cookie round-trips, that an unsigned request cannot read a shelf, that a
multi-MB brickModel survives the split between the Firestore index and the
payload blob, and that re-saving a building replaces it instead of piling up.
"""
from __future__ import annotations

import shutil

import pytest
from fastapi.testclient import TestClient

from app import auth, shelf_store
from app.main import app

ALICE = {"uid": "u-alice", "email": "alice@example.com", "name": "Alice", "picture": ""}
BOB = {"uid": "u-bob", "email": "bob@example.com", "name": "Bob", "picture": ""}


@pytest.fixture(autouse=True)
def local_shelf(tmp_path, monkeypatch):
    """Point the store at a scratch dir — never at a real GCP project."""
    monkeypatch.setattr(shelf_store, "PROJECT", "")
    monkeypatch.setattr(shelf_store, "LOCAL_DIR", tmp_path / "shelf")
    yield
    shutil.rmtree(tmp_path / "shelf", ignore_errors=True)


@pytest.fixture
def client():
    return TestClient(app)


def sign_in(client, who, monkeypatch):
    monkeypatch.setattr(auth, "verify_google_token", lambda _tok: who)
    r = client.post("/api/auth/session", json={"credential": "stub"})
    assert r.status_code == 200
    return r


def a_set(set_id="s1", title="Sagrada Família", bricks=8000):
    """A set shaped like the real thing — a brickModel far past Firestore's 1 MiB."""
    return {
        "id": set_id,
        "title": title,
        "setNumber": "21050",
        "nBricks": bricks,
        "thumb": "data:image/png;base64,AAAA",
        "renderThumb": "data:image/jpeg;base64,BBBB",
        "brickModel": {"bricks": [{"x": i, "y": 0, "z": 0, "color": 15} for i in range(bricks)]},
        "setCopy": {"set_name": title},
        "prompt": title,
    }


# ---------- the gate ----------
def test_shelf_requires_sign_in(client):
    assert client.get("/api/shelf").status_code == 401
    assert client.put("/api/shelf/s1", json=a_set()).status_code == 401
    assert client.delete("/api/shelf/s1").status_code == 401


def test_session_cookie_round_trips(client, monkeypatch):
    assert client.get("/api/auth/me").json()["user"] is None
    sign_in(client, ALICE, monkeypatch)
    assert client.get("/api/auth/me").json()["user"]["uid"] == "u-alice"
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").json()["user"] is None


def test_a_forged_cookie_is_rejected(client):
    client.cookies.set(auth.COOKIE_NAME, "not-a-real-signed-token")
    assert client.get("/api/shelf").status_code == 401


# ---------- the shelf ----------
def test_save_list_and_open_a_large_set(client, monkeypatch):
    sign_in(client, ALICE, monkeypatch)
    item = a_set()
    assert client.put("/api/shelf/s1", json=item).json()["saved"] is True

    # the index is light — no brickModel in the listing
    listed = client.get("/api/shelf").json()["items"]
    assert len(listed) == 1
    assert listed[0]["title"] == "Sagrada Família"
    assert "brickModel" not in listed[0]

    # opening one recombines index + payload
    full = client.get("/api/shelf/s1").json()["item"]
    assert full["nBricks"] == 8000
    assert len(full["brickModel"]["bricks"]) == 8000


def test_resaving_a_building_replaces_it(client, monkeypatch):
    sign_in(client, ALICE, monkeypatch)
    client.put("/api/shelf/s1", json=a_set("s1", "Bilbao", 5000))
    client.put("/api/shelf/s2", json=a_set("s2", "Bilbao", 6000))   # re-tuned, new id

    items = client.get("/api/shelf").json()["items"]
    assert len(items) == 1, "a re-tuned building must not appear twice"
    assert items[0]["nBricks"] == 6000
    assert client.get("/api/shelf/s1").status_code == 404, "the old payload should be gone"


def test_the_cap_drops_the_oldest_never_the_newest(client, monkeypatch):
    sign_in(client, ALICE, monkeypatch)
    for i in range(shelf_store.SHELF_CAP + 3):
        client.put(f"/api/shelf/s{i}", json=a_set(f"s{i}", f"Building {i}", 10))

    items = client.get("/api/shelf").json()["items"]
    assert len(items) == shelf_store.SHELF_CAP
    assert client.get(f"/api/shelf/s{shelf_store.SHELF_CAP + 2}").status_code == 200
    assert client.get("/api/shelf/s0").status_code == 404


def test_one_user_cannot_see_anothers_shelf(client, monkeypatch):
    sign_in(client, ALICE, monkeypatch)
    client.put("/api/shelf/s1", json=a_set())
    client.post("/api/auth/logout")

    sign_in(client, BOB, monkeypatch)
    assert client.get("/api/shelf").json()["items"] == []
    assert client.get("/api/shelf/s1").status_code == 404


def test_delete_removes_index_and_payload(client, monkeypatch):
    sign_in(client, ALICE, monkeypatch)
    client.put("/api/shelf/s1", json=a_set())
    client.delete("/api/shelf/s1")
    assert client.get("/api/shelf").json()["items"] == []
    assert client.get("/api/shelf/s1").status_code == 404
