"""Run: python tools/world/test_bake_dressing.py  (after bake_dressing.py). Trees and scrub stand only where they may."""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib

BASE = os.path.normpath(os.path.join(HERE, "..", "..", "public", "world", "base"))
meta = json.load(open(os.path.join(BASE, "base.json")))
g, d = meta["heights"], meta["dressing"]
path = os.path.join(BASE, "dressing.bin")
rec = np.fromfile(path, dtype="<u2").reshape(-1, 4)
assert d["file"] == "base/dressing.bin" and len(rec) == d["trees"] + d["scrub"], (len(rec), d)
assert 500 <= d["trees"] <= 8000 and 500 <= d["scrub"] <= 12000, d
assert os.path.getsize(path) <= 200e3
x1 = g["x0"] + (g["nx"] - 1) * g["step"]; y1 = g["y0"] + (g["ny"] - 1) * g["step"]
X = g["x0"] + rec[:, 0] / 65535 * (x1 - g["x0"]); Y = g["y0"] + rec[:, 1] / 65535 * (y1 - g["y0"])
scale = rec[:, 2] / 100
c = coastlib.load()
h = c.ground(X, Y); e = 4.0
slope = np.degrees(np.arctan(np.hypot(c.ground(X + e, Y) - c.ground(X - e, Y), c.ground(X, Y + e) - c.ground(X, Y - e)) / (2 * e)))
assert (c.keep_at(X, Y) < 0.02).all(), "an instance stands inside a protected view"
assert (h >= 2.4).all() and (h <= 221).all(), (h.min(), h.max())
assert (slope < 29).all(), slope.max()
t = np.arange(len(rec)) < d["trees"]
assert (scale[t] >= 6).all() and (scale[t] <= 14).all() and (scale[~t] >= 1.5).all() and (scale[~t] <= 4).all()
print(f"ok {d['trees']} trees, {d['scrub']} scrub, {os.path.getsize(path) / 1e3:.0f} kB")
