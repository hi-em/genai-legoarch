"""LDraw export canonicalization (review findings: transposed parts, slope
orientation/origin). Fixtures are the RAW authored geometry of official
parts, measured from the packed library files:
  3001 (2x4 brick): X -40..40, Z -20..20   (long axis along X)
  3010 (1x4 brick): X -40..40, Z -10..10
  3005 (1x1 brick): X -10..10, Z -10..10
  3037 (slope 45 2x4): X -40..40, Z -30..10, downhill -Z, origin on the
       high stud row (footprint centre at Z = -10)
The exporter must place every part so its raw bbox lands EXACTLY on the
engine footprint, and slope downhill must match the engine rot.
"""
import re

from app.legolizer.ldraw import brick_to_ldraw_line, part_transform

RAW_BBOX = {
    "3001": ((-40, 40), (-20, 20)),
    "3010": ((-40, 40), (-10, 10)),
    "3005": ((-10, 10), (-10, 10)),
    "3037": ((-40, 40), (-30, 10)),
}
RAW_DOWNHILL = (0, 0, -1)  # slope family, authored downhill -Z

# engine rot -> expected downhill direction in LDraw world (grid y -> LDraw Z)
EXPECTED_DOWNHILL = {0: (1, 0, 0), 90: (0, 0, 1), 180: (-1, 0, 0), 270: (0, 0, -1)}


def _parse(line):
    f = line.split()
    pos = tuple(float(v) for v in f[2:5])
    m = tuple(float(v) for v in f[5:14])
    return pos, m


def _matvec(m, v):
    return tuple(sum(m[3 * i + k] * v[k] for k in range(3)) for i in range(3))


def _world_bbox(part, pos, m):
    (x0, x1), (z0, z1) = RAW_BBOX[part]
    xs, zs = [], []
    for cx in (x0, x1):
        for cz in (z0, z1):
            wx, _, wz = _matvec(m, (cx, 0, cz))
            xs.append(wx + pos[0])
            zs.append(wz + pos[2])
    return (min(xs), max(xs)), (min(zs), max(zs))


def _expected_footprint(x, y, w, d):
    return (
        (x * 20 - 10, (x + w - 1) * 20 + 10),
        (y * 20 - 10, (y + d - 1) * 20 + 10),
    )


def test_rect_parts_land_on_their_footprint_in_all_rotations():
    cases = [
        ("3001", 0, 2, 4), ("3001", 90, 4, 2),
        ("3010", 0, 1, 4), ("3010", 90, 4, 1),
        ("3005", 0, 1, 1),
    ]
    for part, rot, w, d in cases:
        line = brick_to_ldraw_line(part, 3, 5, 0, 15, rot, w, d, 3)
        pos, m = _parse(line)
        got = _world_bbox(part, pos, m)
        want = _expected_footprint(3, 5, w, d)
        assert got == want, f"{part} rot{rot}: bbox {got} != footprint {want}"


def test_slope_lands_on_footprint_and_faces_downhill_all_rotations():
    for rot in (0, 90, 180, 270):
        w, d = (2, 4) if rot in (0, 180) else (4, 2)
        line = brick_to_ldraw_line("3037", 2, 2, 3, 4, rot, w, d, 3)
        pos, m = _parse(line)
        got = _world_bbox("3037", pos, m)
        want = _expected_footprint(2, 2, w, d)
        assert got == want, f"slope rot{rot}: bbox {got} != footprint {want}"
        downhill = _matvec(m, RAW_DOWNHILL)
        assert tuple(round(v) for v in downhill) == EXPECTED_DOWNHILL[rot], (
            f"slope rot{rot}: downhill {downhill} != {EXPECTED_DOWNHILL[rot]}"
        )


def test_matrices_are_proper_rotations():
    """det = +1: no part may be mirrored by the export transform."""
    for part in ("3001", "3010", "3005", "3037"):
        for rot in (0, 90, 180, 270):
            _, m = _parse(brick_to_ldraw_line(part, 0, 0, 0, 15, rot, 1, 1, 3))
            det = (
                m[0] * (m[4] * m[8] - m[5] * m[7])
                - m[1] * (m[3] * m[8] - m[5] * m[6])
                + m[2] * (m[3] * m[7] - m[4] * m[6])
            )
            assert round(det, 6) == 1.0, f"{part} rot{rot} det={det}"


def test_square_unrotated_parts_keep_legacy_bytes():
    """1x1/2x2 etc. at rot 0 must stay byte-identical with the old exporter."""
    line = brick_to_ldraw_line("3005", 4, 7, 6, 15, 0, 1, 1, 3)
    assert line == "1 15 80 -48 140 1 0 0 0 1 0 0 0 1 3005.dat"
