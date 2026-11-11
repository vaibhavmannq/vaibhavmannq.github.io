"""Run: python tools/world/test_views.py  (the view checker casts the nine cameras' rays the way raymap.py does)."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coastlib, views

HOURS = {"golden", "sunset", "dusk", "bluehour", "night", "midnight", "beforedawn", "firstlight", "sunrise"}

flat = lambda x, y: np.full(np.shape(x), 5.0)
o = np.array([[0.0, 0.0, 15.0]]); d = np.array([[0.0, np.sqrt(0.5), -np.sqrt(0.5)]])
t, k = views.cast(flat, o, d)
assert k[0] == 2 and abs(t[0] - 10 * np.sqrt(2)) < 0.3, (t, k)          # 45° down onto a plane 10 m below
t, k = views.cast(flat, o, np.array([[0.0, 1.0, 0.05]]))
assert k[0] == 0, k                                                      # upward ray: sky
# A cloud layer hides what lies under it (Midnight's sea of cloud): the ray stops on it, kind CLOUD.
t, k = views.cast(flat, o, d, cloud=(10.0, -50.0, 50.0, -50.0, 50.0))
assert k[0] == views.CLOUD and abs(t[0] - 5 * np.sqrt(2)) < 0.3, (t, k)
t, k = views.cast(flat, o, d, cloud=(10.0, 100.0, 200.0, 100.0, 200.0))          # cloud elsewhere: ground as before
assert k[0] == views.LAND, k
assert views.cloud_planes() == {"midnight": (142.0, -1600.0, 380.0, -2200.0, -420.0)}, views.cloud_planes()
cams = views.cameras()
assert set(cams) == HOURS and abs(cams["golden"].z - 0.9151) < 1e-3, cams["golden"]
o, d = views.ray_grid(cams["golden"], 96)
assert np.allclose(np.linalg.norm(d, axis=1), 1.0)
assert np.degrees(np.ptp(np.arcsin(d[:, 2]))) > 60                      # portrait's tall field at lens 24 is covered
c = coastlib.load()
for name in ("golden", "midnight"):                                      # the ceiling shortcut changes nothing
    o, d = views.ray_grid(cams[name], 16)
    tb, kb = views.cast(c.ground_base, o, d, bounded=False); tc, kc = views.cast(c.ground_base, o, d)
    assert np.array_equal(kb, kc) and np.array_equal(tb, tc), name
two = {k: cams[k] for k in ("sunset", "bluehour")}
assert all(v == 0.0 for v in views.compare(c.ground_base, c.ground_base, two, 32).values())
# A 60 m hill pushed up beside the Sunset view; only rays that pass over changed ground are cast again.
bump = lambda x, y: np.hypot(np.asarray(x) + 200, np.asarray(y) - 120) < 150
hill = lambda x, y: c.ground_base(x, y) + np.where(bump(x, y), 60.0, 0.0)
full = views.compare(c.ground_base, hill, two, 32)
quick = views.compare(c.ground_base, hill, two, 32, same_where=lambda x, y: ~bump(x, y))
assert full == quick and full["sunset"] > 0, (full, quick)
near = views.compare(c.ground_base, hill, two, 32, same_where=lambda x, y: ~bump(x, y), near=1500.0)
assert near == full, (near, full)                                       # the hill stands 226 m from Sunset's camera
close = views.compare(c.ground_base, hill, two, 32, same_where=lambda x, y: ~bump(x, y), near=60.0)
assert close["sunset"] == 0.0, close                                    # nothing within 60 m changed
L = views.light_dirs()
assert L["dusk"] is None and L["golden"] is not None and L["midnight"] is not None, L
assert views.shadowed(flat, np.array([[0.0, 0.0, 5.0]]), (0.0, 0.0, 1.0))[0] == False
assert views.shadowed(lambda x, y: np.where(np.asarray(y) > 20, 50.0, 5.0), np.array([[0.0, 0.0, 5.0]]), (0.0, 0.7071, 0.7071))[0]
print("ok")
