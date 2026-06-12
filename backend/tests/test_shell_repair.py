"""Hollow-shell voxelization + connectivity repair tests (Sprint 1B)."""
import numpy as np

from app.legolizer import legolize_voxelgrid
from app.mesh_voxelize import _shell, _solidify


def _box(nx, ny, nz):
    return np.ones((nx, ny, nz), dtype=bool)


def test_shell_hollows_a_solid_box():
    solid = _box(12, 12, 18)
    sh = _shell(solid, t_xy=2, t_z=5)
    assert sh.sum() < solid.sum()
    # walls stay: full faces survive
    assert sh[0, :, :].all() and sh[-1, :, :].all()
    assert sh[:, 0, :].all() and sh[:, -1, :].all()
    assert sh[:, :, 0].all() and sh[:, :, -1].all()
    # core is gone
    assert not sh[6, 6, 9]


def test_shell_wall_thickness_is_anisotropic():
    solid = _box(12, 12, 30)
    sh = _shell(solid, t_xy=2, t_z=5)
    # horizontal wall = exactly 2 cells (studs): 3rd cell in is empty mid-height
    assert sh[0, 6, 15] and sh[1, 6, 15] and not sh[2, 6, 15]
    # vertical floor/roof = 5 cells (plates)
    assert sh[6, 6, 4] and not sh[6, 6, 5]


def test_shell_keeps_exterior_voids_open():
    """A courtyard open to the sky must stay open (it is outside air)."""
    solid = _box(16, 16, 12)
    solid[6:10, 6:10, :] = False          # open-to-sky courtyard shaft
    filled = _solidify(solid)
    assert not filled[7, 7, 6], "courtyard must survive solidify"
    sh = _shell(filled, t_xy=2, t_z=5)
    assert not sh[7, 7, 6], "courtyard must survive shelling"
    # and the courtyard gets its own wall: cells adjacent to the shaft stay
    assert sh[5, 7, 6] and sh[10, 7, 6]


def test_repair_grounds_floating_component():
    occ = np.zeros((4, 4, 12), dtype=bool)
    occ[:, :, 0:3] = True                 # grounded slab
    occ[1:3, 1:3, 9:12] = True            # floating cube high above
    model = legolize_voxelgrid(_occupancy=occ, options={"seed": 1})
    st = model.stability
    assert st["components_before"] == 2
    assert st["components_after"] == 1
    assert st["pillars_added"] >= 2       # 6-plate gap = 2 bricks per pillar
    assert st["connected"] is True        # analyze runs after repair


def test_repair_noop_on_connected_model():
    occ = np.ones((4, 4, 6), dtype=bool)
    model = legolize_voxelgrid(_occupancy=occ, options={"seed": 1})
    assert model.stability["pillars_added"] == 0
    assert model.stability["components_before"] == 1


def test_repair_can_be_disabled():
    occ = np.zeros((4, 4, 12), dtype=bool)
    occ[:, :, 0:3] = True
    occ[1:3, 1:3, 9:12] = True
    model = legolize_voxelgrid(_occupancy=occ, options={"seed": 1, "repair": False})
    assert model.stability["connected"] is False
    assert "pillars_added" not in model.stability
