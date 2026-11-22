"""Run: python tools/world/test_patch.py (after bake_base.py --patches). The finer patches (plan world-to-100 Task 10)."""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bake_base, coastlib

BASE = os.path.normpath(os.path.join(HERE, "..", "..", "public", "world", "base"))
meta = json.load(open(os.path.join(BASE, "base.json"), encoding="utf-8"))
m = meta["heights"]
q8 = np.fromfile(os.path.join(BASE, "heights.bin"), dtype="<u2").reshape(m["ny"], m["nx"])
H = m["lo"] + q8.astype(np.float64) * (m["hi"] - m["lo"]) / 65535
c = coastlib.load()
assert meta.get("patches"), "base.json lists the patches"
for p in meta["patches"]:
    q = np.fromfile(os.path.normpath(os.path.join(BASE, "..", p["file"])), dtype="<u2").reshape(p["ny"], p["nx"])
    h = p["lo"] + q.astype(np.float64) * (p["hi"] - p["lo"]) / 65535
    xs = p["x0"] + np.arange(p["nx"]) * p["step"]; ys = p["y0"] + np.arange(p["ny"]) * p["step"]
    X, Y = np.meshgrid(xs, ys)
    live = bake_base.tri_height(H, m, X, Y)
    # the patch's edge equals the 8 m heights within 1 cm (no seam where the base is cut away)
    border = np.concatenate([h[0] - live[0], h[-1] - live[-1], h[:, 0] - live[:, 0], h[:, -1] - live[:, -1]])
    assert np.abs(border).max() < 0.01, f"{p['id']}: edge off the 8 m ground by {np.abs(border).max():.3f} m"
    # its corners lie on the 8 m grid's lines (the base's triangles meet it along whole edges)
    assert (p["x0"] - m["x0"]) % m["step"] == 0 and (p["y0"] - m["y0"]) % m["step"] == 0
    assert ((p["nx"] - 1) * p["step"]) % m["step"] == 0 and ((p["ny"] - 1) * p["step"]) % m["step"] == 0
    # PROTECT spots keep their height within 5 cm
    for px, py in c.PROTECT:
        if not (xs[0] <= px <= xs[-1] and ys[0] <= py <= ys[-1]):
            continue
        i = int(round((px - p["x0"]) / p["step"])); j = int(round((py - p["y0"]) / p["step"]))
        assert abs(h[j, i] - live[j, i]) < 0.05, f"{p['id']}: spot {px, py} moved {h[j, i] - live[j, i]:.3f} m"
    # inside, the patch is the formula (the point of it): a cliff face away from every spot and the edge
    inner = (np.minimum.reduce([X - xs[0], xs[-1] - X, Y - ys[0], ys[-1] - Y]) > 20)
    far = np.ones_like(X, bool)
    for px, py in list(c.PROTECT) + [c.CAVE]:
        far &= np.hypot(X - px, Y - py) > 60
    sel = inner & far
    f = np.asarray(c.ground(X[sel], Y[sel]))
    assert np.abs(h[sel] - f).max() < 0.02, f"{p['id']}: inside, off the formula by {np.abs(h[sel] - f).max():.3f} m"
print("patch: all checks passed")
