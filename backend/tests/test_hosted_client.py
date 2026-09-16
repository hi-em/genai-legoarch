"""hosted_client internals, with no route or fixture in the way: the prompt
wording, the style references, Hunyuan's OBJ bundle -> GLB conversion, and the
one-retry policy on fal 5xx."""
from __future__ import annotations

import base64
import io

import pytest

from app import hosted_client

PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def test_prompt_carries_base_plate_and_negatives_as_prose():
    p = hosted_client.build_image_prompt("Sagrada Família", "people, trees, thin spires")
    assert "LEGO Architecture set" in p
    assert "thin flat black LEGO base plate" in p
    assert "Do not include: people, trees, thin spires." in p


def test_style_refs_are_our_own_renders_not_lego_photos():
    names = set(hosted_client.STYLE_REF_FILES)
    assert names == {"sagrada.jpg", "muralla.jpg", "bilbao.jpg"}
    for n in names:
        assert (hosted_client.STYLE_REF_DIR / n).exists()
    assert "legoarch-dataset" not in str(hosted_client.STYLE_REF_DIR)


def test_obj_bundle_becomes_textured_glb():
    """A unit cube with a 2x2 texture: the GLB must carry the colour through."""
    from PIL import Image
    import numpy as np
    import trimesh

    obj = b"""mtllib material.mtl
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
usemtl Material
f 1/1 2/2 3/3
f 1/1 3/3 4/4
"""
    mtl = b"newmtl Material\nmap_Kd tex.png\n"
    buf = io.BytesIO()
    Image.fromarray(np.full((2, 2, 3), (200, 30, 30), dtype=np.uint8)).save(buf, format="PNG")
    glb = hosted_client.obj_bundle_to_glb(obj, mtl, buf.getvalue())
    assert glb[:4] == b"glTF"
    # matte plastic, not the glTF default of fully-metallic (renders black in
    # a viewer without an environment map) and no darkening base factor
    import json, struct
    ln = struct.unpack_from("<I", glb, 12)[0]
    pbr = json.loads(glb[20:20 + ln])["materials"][0]["pbrMetallicRoughness"]
    assert pbr["metallicFactor"] == 0.0
    assert pbr.get("baseColorFactor", [1, 1, 1, 1]) == [1, 1, 1, 1]
    assert "baseColorTexture" in pbr
    mesh = trimesh.load(io.BytesIO(glb), file_type="glb", force="mesh")
    assert len(mesh.faces) == 2
    rgb = mesh.visual.to_color().vertex_colors[:, :3]
    assert (abs(rgb.astype(int) - (200, 30, 30)).max()) < 8


def test_fal_5xx_is_retried_once(monkeypatch, tmp_path):
    monkeypatch.setattr(hosted_client, "OUTPUT_3D_DIR", tmp_path)
    monkeypatch.setattr(hosted_client, "MODEL_3D", "trellis2")
    monkeypatch.setattr(hosted_client, "FAL_KEY", "k")
    calls = []

    class Boom(Exception):
        status_code = 504

    class FakeClient:
        def upload(self, data, content_type, **kw):
            return "https://fal.test/in.png"

        def subscribe(self, endpoint, arguments, **kw):
            calls.append(endpoint)
            if len(calls) == 1:
                raise Boom("downstream service unavailable")
            return {"model_glb": {"url": "https://fal.test/out.glb"}}

    monkeypatch.setattr(hosted_client, "_fal", lambda: FakeClient())
    monkeypatch.setattr(hosted_client, "_download", lambda url: b"glTF-bytes")
    monkeypatch.setattr(hosted_client.time, "sleep", lambda s: None)
    out = hosted_client.run_trellis(PNG_1x1, seed=5)
    assert out["glb"] == b"glTF-bytes" and out["params"]["attempts"] == 2
    assert (tmp_path / out["filename"]).exists()
    assert calls == ["fal-ai/trellis-2", "fal-ai/trellis-2"]


def test_fal_4xx_is_not_retried(monkeypatch, tmp_path):
    monkeypatch.setattr(hosted_client, "OUTPUT_3D_DIR", tmp_path)
    monkeypatch.setattr(hosted_client, "FAL_KEY", "k")

    class Nope(Exception):
        status_code = 422

    class FakeClient:
        def upload(self, data, content_type, **kw):
            return "u"

        def subscribe(self, *a, **kw):
            raise Nope("bad input")

    monkeypatch.setattr(hosted_client, "_fal", lambda: FakeClient())
    with pytest.raises(RuntimeError):
        hosted_client.run_trellis(PNG_1x1)
