"""Run: python tools/world/test_bake_light.py. The light bake's shadow heights and occlusion on made-up ground."""
import math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bake_light as bl

G = dict(x0=0.0, y0=0.0, step=2.0, nx=201, ny=201)


def flat(z=0.0):
    return np.full((G["ny"], G["nx"]), z)


def wall(z):
    """A wall 30 m high and 10 m thick along x = 200..210."""
    z = z.copy()
    z[:, 100:106] = 30.0
    return z


def lit(occ, x, y, z, d):
    hs, w = bl.shadow_height(occ, np.array([x]), np.array([y]), d)
    return float(np.clip((z - (hs[0] - w[0])) / (2 * w[0]), 0, 1))


sun = bl.views._sun_dir(20.0, 90.0)  # 20 degrees up, toward +x (east)
occ = bl.Occluder(G, wall(flat()))
# a wall shadows the ground behind it (west of it, the sun in the east), out to 30 / tan 20 deg = 82 m
assert lit(occ, 150, 200, 0.0, sun) < 0.05, "ground 50 m behind the wall is in shadow"
assert lit(occ, 100, 200, 0.0, sun) > 0.95, "ground 100 m behind the wall (past 82 m) is lit"
assert lit(occ, 300, 200, 0.0, sun) > 0.95, "ground on the sunny side is lit"
# a point high enough above the shadowed ground sees over the wall: lit where z > 30 - s tan(el)
assert lit(occ, 150, 200, 25.0, sun) > 0.95, "a treetop 25 m up, 50 m behind, sees over the wall"
# the penumbra widens with distance from the wall
_, w_near = bl.shadow_height(occ, np.array([190.0]), np.array([200.0]), sun)
_, w_far = bl.shadow_height(occ, np.array([140.0]), np.array([200.0]), sun)
assert w_far[0] > w_near[0], "a far edge is softer than a near one"
# flat open ground: no shadow, and the sky's share is ~1
occ_flat = bl.Occluder(G, flat())
assert lit(occ_flat, 200, 200, 0.0, sun) > 0.95
ao = bl.horizon_ao(occ_flat, np.array([200.0]), np.array([200.0]), np.array([0.0]))
assert ao[0] > 0.99, f"flat open ground has AO ~ 1 (got {ao[0]:.3f})"
# at the wall's foot the sky is partly hidden
ao_foot = bl.horizon_ao(occ, np.array([198.0]), np.array([200.0]), np.array([0.0]))
assert 0.5 < ao_foot[0] < 0.95, f"a wall's foot sees less sky (got {ao_foot[0]:.3f})"
# a sloping sunny face does not shadow itself (the march starts S0 from the receiver)
slope = np.tile(np.arange(G["nx"]) * G["step"] * math.tan(math.radians(10)), (G["ny"], 1))  # rises toward +x...
occ_slope = bl.Occluder(G, -slope + slope.max())  # ... reversed: falls toward the east sun, faces it
z0 = float(occ_slope.at(np.array([200.0]), np.array([200.0]))[0])
assert lit(occ_slope, 200, 200, z0, sun) > 0.95, "a slope facing the sun is lit"
# the code round-trips
hs = np.array([[-29.0, 0.0, 12.345, 300.0]]); w = np.array([[0.3, 1.0, 2.5, 25.0]])
h2, w2 = bl.decode_key(bl.encode_key(hs, w))
assert np.abs(h2 - hs).max() <= bl.H_STEP / 2 + 1e-9 and np.abs(w2 - w).max() < 0.051
# the live ground: the grid's own corners come back exactly
meta, H, R = bl.load_base()
m = meta["heights"]
X = m["x0"] + np.array([3, 17]) * m["step"]; Y = m["y0"] + np.array([5, 40]) * m["step"]
assert np.allclose(bl.grid_height(H, m, X, Y), H[[5, 40], [3, 17]])
print("bake_light: all checks passed")


def test_split_files_rejoin_to_the_stacked_image():
    img = np.arange(5 * 4 * 3 * 3, dtype=np.uint8).reshape(5 * 4, 3, 3)
    parts = bl.split_layers(img, 5)
    assert len(parts) == 5 and all(p.shape == (4, 3, 3) for p in parts)
    assert np.array_equal(np.concatenate(parts), img)


def test_hour_files_name_one_pair_per_hour():
    f = bl.hour_files(["golden", "night"])
    assert f["hours"]["night"] == dict(keyCoarse="light/key-coarse-night.webp", keyFine="light/key-fine-night.webp")
    assert f["aoCoarse"] == "light/ao-coarse.webp"
