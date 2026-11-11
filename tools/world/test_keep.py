"""Run: python tools/world/test_keep.py  (after bake_keep.py). Everything the nine cameras see within views.NEAR is protected."""
import os, shutil, sys, tempfile
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib, views

KEEP = os.path.join(HERE, "blender", "keep.npz")
c = coastlib.load(); cams = views.cameras()
for name, cam in cams.items():
    o, d = views.ray_grid(cam, 64); t, k = views.cast(c.ground_base, o, d, cloud=views.cloud_planes().get(name))
    hit = ((k == views.SEA) | (k == views.LAND)) & (t <= views.NEAR); p = o[hit] + d[hit] * t[hit, None]
    assert (c.keep_at(p[:, 0], p[:, 1]) > 0.999).all(), name          # every seen point is protected
    assert c.keep_at(cam.x, cam.y) > 0.999, name
assert c.keep_at(9000.0, 9000.0) == 0.0                               # outside the grid
share = (np.load(KEEP)["keep"] > 0).mean(); print(f"protected share {share:.2f}"); assert share < 0.6

# A missing keep.npz fails loudly instead of leaving the world unprotected (plan Review Focus 1).
saved = coastlib.COAST
with tempfile.TemporaryDirectory() as tmp:
    coastlib.COAST = shutil.copy(saved, os.path.join(tmp, "coast.py"))
    try:
        bare = coastlib.load()
        try:
            bare.keep_at(0.0, 0.0)
            raise AssertionError("keep_at worked without keep.npz")
        except FileNotFoundError as e:
            assert "keep.npz" in str(e), e
    finally:
        coastlib.COAST = saved
print("ok")
