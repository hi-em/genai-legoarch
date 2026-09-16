"""The hosted generation path: provider switch, sign-in gate, spend counters.

The providers themselves are stubbed — what is under test is OUR half: that
GENERATION_BACKEND=hosted routes to hosted_client with the comfy_client
signatures, that a guest cannot spend money, that the per-user daily and the
global monthly limits stop calls BEFORE the provider is hit. The client's own
internals (retry, OBJ -> GLB, prompt wording) live in test_hosted_client.py.
"""
from __future__ import annotations

import base64
import json
import shutil

import pytest
from fastapi.testclient import TestClient

from app import auth, hosted_client, main, quota, shelf_store
from app.main import app

ALICE = {"uid": "u-alice", "email": "alice@example.com", "name": "Alice", "picture": ""}
PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


@pytest.fixture(autouse=True)
def hosted_local(tmp_path, monkeypatch):
    """Hosted backend, local (file) quota store, stubbed providers."""
    monkeypatch.setattr(main, "GENERATION_BACKEND", "hosted")
    monkeypatch.setattr(shelf_store, "PROJECT", "")
    monkeypatch.setattr(shelf_store, "LOCAL_DIR", tmp_path / "shelf")
    monkeypatch.setattr(hosted_client, "OUTPUT_3D_DIR", tmp_path / "meshes")
    monkeypatch.setattr(hosted_client, "FAL_KEY", "test-key")
    monkeypatch.setattr(hosted_client, "GOOGLE_CLOUD_PROJECT", "test-project")
    monkeypatch.setattr(quota, "USER_DAILY", {"image": 2, "mesh": 2})
    monkeypatch.setattr(quota, "MONTHLY_BUDGET_USD", 10.0)
    monkeypatch.setattr(quota, "COST_USD", {"image": 0.08, "mesh": 0.25})
    calls = {"image": 0, "mesh": 0}

    def fake_txt2img(prompt, **kw):
        calls["image"] += 1
        return {"png": PNG_1x1, "params": {"backend": "hosted", "prompt": prompt, **kw}}

    def fake_trellis(image, **kw):
        calls["mesh"] += 1
        (tmp_path / "meshes").mkdir(exist_ok=True)
        (tmp_path / "meshes" / "hosted_test.glb").write_bytes(b"glTF")
        return {"glb": b"glTF", "filename": "hosted_test.glb", "params": {"backend": "hosted", **kw}}

    monkeypatch.setattr(hosted_client, "run_txt2img", fake_txt2img)
    monkeypatch.setattr(hosted_client, "run_img2img", lambda prompt, image, **kw: fake_txt2img(prompt, photo=True, **kw))
    monkeypatch.setattr(hosted_client, "run_trellis", fake_trellis)
    yield calls
    shutil.rmtree(tmp_path / "shelf", ignore_errors=True)


@pytest.fixture
def client():
    return TestClient(app)


def sign_in(client, monkeypatch, who=ALICE):
    monkeypatch.setattr(auth, "verify_google_token", lambda _tok: who)
    assert client.post("/api/auth/session", json={"credential": "stub"}).status_code == 200


# ---------- capabilities ----------
def test_capabilities_report_hosted_stages(client):
    caps = client.get("/api/capabilities").json()
    assert caps["generation"] == "hosted"
    assert caps["image"] is True and caps["mesh"] is True and caps["gpu"] is True
    assert caps["signInRequired"] is True
    assert caps["limits"]["userDailyImages"] == 2
    assert caps["hosted"]["meshModel"] in ("hunyuan", "trellis2")


def test_capabilities_unconfigured_hosted_reads_offline(client, monkeypatch):
    monkeypatch.setattr(hosted_client, "FAL_KEY", "")
    caps = client.get("/api/capabilities").json()
    assert caps["image"] is True and caps["mesh"] is False and caps["gpu"] is False


def test_comfyui_default_is_unchanged(client, monkeypatch):
    monkeypatch.setattr(main, "GENERATION_BACKEND", "comfyui")
    monkeypatch.setattr(main, "_comfy_up", lambda base, timeout=1.5: False)
    caps = client.get("/api/capabilities").json()
    assert caps["generation"] == "comfyui" and caps["signInRequired"] is False
    # and a guest is NOT gated on the local path (the route fails later on the
    # missing ComfyUI, not on auth)
    r = TestClient(app, raise_server_exceptions=False).post("/api/generate-image", json={"prompt": "x"})
    assert r.status_code != 401


# ---------- the gate ----------
def test_guest_cannot_spend(client, hosted_local):
    r = client.post("/api/generate-image", json={"prompt": "Sagrada Família"})
    assert r.status_code == 401 and r.json()["detail"]["code"] == "not_signed_in"
    r = client.post("/api/generate-mesh", json={"image_b64": base64.b64encode(PNG_1x1).decode()})
    assert r.status_code == 401
    assert hosted_local == {"image": 0, "mesh": 0}   # the provider was never called


def test_signed_in_user_forges_through_hosted_client(client, monkeypatch, hosted_local):
    sign_in(client, monkeypatch)
    r = client.post("/api/generate-image", json={"prompt": "Sagrada Família", "seed": 7})
    assert r.status_code == 200
    assert r.json()["imageUrl"].startswith("data:image/png;base64,")
    assert r.json()["params"]["backend"] == "hosted" and r.json()["params"]["seed"] == 7
    r = client.post("/api/generate-mesh", json={"image_b64": base64.b64encode(PNG_1x1).decode()})
    assert r.status_code == 200 and r.json()["glbUrl"] == "/api/mesh/hosted_test.glb"
    # and the mesh route serves it from the hosted cache dir, not ComfyUI's
    assert client.get("/api/mesh/hosted_test.glb").status_code == 200
    assert hosted_local == {"image": 1, "mesh": 1}


def test_user_daily_limit_stops_before_the_provider(client, monkeypatch, hosted_local):
    sign_in(client, monkeypatch)
    body = {"prompt": "Sagrada Família"}
    assert client.post("/api/generate-image", json=body).status_code == 200
    assert client.post("/api/generate-image", json=body).status_code == 200
    r = client.post("/api/generate-image", json=body)
    assert r.status_code == 429 and r.json()["detail"]["code"] == "user_daily_limit"
    assert hosted_local["image"] == 2
    # meshes are counted separately
    assert client.post("/api/generate-mesh", json={"image_b64": base64.b64encode(PNG_1x1).decode()}).status_code == 200


def test_delete_account_forgets_the_daily_counter(client, monkeypatch, hosted_local):
    """The privacy page promises deletion erases everything on the account —
    including the new per-day forge count, which lives in a subcollection."""
    sign_in(client, monkeypatch)
    assert client.post("/api/generate-image", json={"prompt": "a"}).status_code == 200
    data = json.loads((shelf_store.LOCAL_DIR / "quota.json").read_text())
    assert any(k.startswith("user:u-alice:") for k in data)
    assert client.delete("/api/me").json()["deleted"] is True
    data = json.loads((shelf_store.LOCAL_DIR / "quota.json").read_text())
    assert not any(k.startswith("user:u-alice:") for k in data)
    assert any(k.startswith("month:") for k in data)     # the global spend stays
    # a fresh sign-in starts from zero again
    sign_in(client, monkeypatch)
    assert client.post("/api/generate-image", json={"prompt": "b"}).status_code == 200


def test_monthly_budget_is_global(client, monkeypatch, hosted_local):
    monkeypatch.setattr(quota, "MONTHLY_BUDGET_USD", 0.10)   # room for one image, not two
    sign_in(client, monkeypatch)
    assert client.post("/api/generate-image", json={"prompt": "a"}).status_code == 200
    bob = {**ALICE, "uid": "u-bob", "email": "bob@example.com"}
    sign_in(client, monkeypatch, bob)
    r = client.post("/api/generate-image", json={"prompt": "b"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "monthly_budget"
    assert hosted_local["image"] == 1
