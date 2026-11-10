"""Run: python tools/world/test_bake_base.py  (after bake_base.py). The baked base matches coast.py's ground."""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import coastlib

BASE = os.path.normpath(os.path.join(HERE, "..", "..", "public", "world", "base"))
REF = [(9.5, -4), (25, 141), (0, 0), (-30, 20), (40, 10), (22, 50), (12.93, 140.37), (-1171.4, 1218.9), (-1000, 1150),
       (100, -100), (-60, -205), (600, -950), (300, 300), (-20, 60)]

meta = json.load(open(os.path.join(BASE, "base.json")))
m = meta["heights"]
q = np.fromfile(os.path.join(BASE, "heights.bin"), dtype="<u2").reshape(m["ny"], m["nx"])
H = m["lo"] + q.astype(np.float64) * (m["hi"] - m["lo"]) / 65535


def sample(x, y):
    fx = (x - m["x0"]) / m["step"]; fy = (y - m["y0"]) / m["step"]
    i = min(m["nx"] - 2, int(fx)); j = min(m["ny"] - 2, int(fy)); u = fx - i; v = fy - j
    return (H[j, i] * (1 - u) + H[j, i + 1] * u) * (1 - v) + (H[j + 1, i] * (1 - u) + H[j + 1, i + 1] * u) * v


c = coastlib.load()
rng = np.random.default_rng(7)
RANDOM = list(zip(rng.uniform(-1990, 1190, 300), rng.uniform(-2390, 1590, 300)))
checked = 0
for x, y in REF + RANDOM:
    if np.hypot(x - c.CAVE[0], y - c.CAVE[1]) < 10:
        continue
    g = float(c.ground(x, y))
    # flat across a whole 8 m cell: an 8 m grid cannot hold a cliff edge nearer than that
    around = [float(c.ground(x + dx, y + dy)) for dx in (-8, 0, 8) for dy in (-8, 0, 8)]
    if max(around) - min(around) > 1.0:
        continue
    assert abs(sample(x, y) - g) < 0.6, (x, y, sample(x, y), g)
    checked += 1
files = ["heights.bin", "ring.bin", "colour.webp"]
total = sum(os.path.getsize(os.path.join(BASE, f)) for f in files)
assert total <= 0.8e6, total
assert m["nx"] == 401 and m["ny"] == 501, m
print(f"ok {checked} flat points within 0.6 m; base files {total / 1e6:.2f} MB")
